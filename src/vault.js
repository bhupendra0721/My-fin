/* MyFinance local encrypted vault.
 * All finance records stay in this browser's IndexedDB. No network requests.
 * PIN and recovery password wrap a random data-encryption key (DEK).
 */
const DB_NAME = "myfinance-secure";
const DB_VERSION = 1;
const STORE_NAME = "vault";
const RECORD_KEY = "primary";
const LEGACY_KEY = "myfinance-v3";
const FORMAT = "myfinance-encrypted-backup-v1";
const ITERATIONS = 600000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function cryptoApi() {
  if (!globalThis.crypto?.subtle) throw new Error("Secure encryption is unavailable. Open MyFinance over HTTPS in a supported browser.");
  return globalThis.crypto;
}
function bytesToBase64(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function randomBytes(length) {
  const bytes = new Uint8Array(length);
  cryptoApi().getRandomValues(bytes);
  return bytes;
}
async function deriveKey(secret, salt) {
  const material = await cryptoApi().subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return cryptoApi().subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}
async function encryptBytes(key, bytes) {
  const iv = randomBytes(12);
  const ciphertext = await cryptoApi().subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}
async function decryptBytes(key, record) {
  const plaintext = await cryptoApi().subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(record.iv) }, key, base64ToBytes(record.ciphertext)
  );
  return new Uint8Array(plaintext);
}
async function wrapKey(secret, rawDek) {
  const salt = randomBytes(16), wrappingKey = await deriveKey(secret, salt);
  return { salt: bytesToBase64(salt), ...(await encryptBytes(wrappingKey, rawDek)) };
}
async function unwrapKey(secret, wrapped) {
  const wrappingKey = await deriveKey(secret, base64ToBytes(wrapped.salt));
  return decryptBytes(wrappingKey, wrapped);
}
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open secure storage."));
  });
}
async function dbGet() {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
async function dbPut(record) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record, RECORD_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Secure storage write was cancelled."));
    });
  } finally { db.close(); }
}
async function dbDelete() {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(RECORD_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Secure storage deletion was cancelled."));
    });
  } finally { db.close(); }
}
function validateCredentials(pin, recoveryPassword) {
  if (!/^\d{6,12}$/.test(String(pin))) throw new Error("Use a PIN with 6 to 12 digits.");
  if (String(recoveryPassword).length < 12) throw new Error("Use a recovery password with at least 12 characters.");
}
function normaliseData(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.transactions)) throw new Error("The finance data format is not valid.");
  return {
    transactions: value.transactions,
    budgets: value.budgets && typeof value.budgets === "object" ? value.budgets : {},
    goals: Array.isArray(value.goals) ? value.goals : [],
    recurring: Array.isArray(value.recurring) ? value.recurring : [],
    settings: Object.assign({ theme: "light", budgetAlert: false, billAlert: false }, value.settings || {})
  };
}
async function buildVault(data, pin, recoveryPassword) {
  validateCredentials(pin, recoveryPassword);
  const dek = randomBytes(32);
  const dataKey = await cryptoApi().subtle.importKey("raw", dek, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const encryptedData = await encryptBytes(dataKey, encoder.encode(JSON.stringify(normaliseData(data))));
  return {
    version: 1, algorithm: "AES-GCM", kdf: "PBKDF2-SHA-256", iterations: ITERATIONS,
    encryptedData, pinWrap: await wrapKey(pin, dek), recoveryWrap: await wrapKey(recoveryPassword, dek),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
}
async function decryptVault(record, secret, mode) {
  if (!record || record.version !== 1) throw new Error("Encrypted finance data is missing or has an unsupported version.");
  const wrapped = mode === "recovery" ? record.recoveryWrap : record.pinWrap;
  if (!wrapped) throw new Error("This unlock method is not available.");
  let dek;
  try { dek = await unwrapKey(secret, wrapped); }
  catch { throw new Error(mode === "recovery" ? "Recovery password is incorrect." : "PIN is incorrect."); }
  const dataKey = await cryptoApi().subtle.importKey("raw", dek, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  try { return normaliseData(JSON.parse(decoder.decode(await decryptBytes(dataKey, record.encryptedData)))); }
  catch { throw new Error("The encrypted finance data could not be verified. Do not delete your recovery backup."); }
}
export async function vaultExists() { return Boolean(await dbGet()); }
export async function createVault(data, pin, recoveryPassword) {
  if (await dbGet()) throw new Error("A secure vault already exists.");
  const record = await buildVault(data, pin, recoveryPassword);
  await dbPut(record);
  const verified = await decryptVault(await dbGet(), pin, "pin");
  if (JSON.stringify(verified) !== JSON.stringify(normaliseData(data))) {
    await dbDelete();
    throw new Error("Secure storage verification failed. Your original records have not been changed.");
  }
  return { transactionCount: verified.transactions.length };
}
export async function unlockVault(secret, mode = "pin") {
  const record = await dbGet();
  const data = await decryptVault(record, secret, mode);
  return {
    data,
    save: async nextData => {
      const current = await dbGet();
      const wrapped = mode === "recovery" ? current.recoveryWrap : current.pinWrap;
      const dek = await unwrapKey(secret, wrapped);
      const dataKey = await cryptoApi().subtle.importKey("raw", dek, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
      const updated = { ...current, encryptedData: await encryptBytes(dataKey, encoder.encode(JSON.stringify(normaliseData(nextData)))), updatedAt: new Date().toISOString() };
      await dbPut(updated);
      const check = await decryptVault(await dbGet(), secret, mode);
      if (JSON.stringify(check) !== JSON.stringify(normaliseData(nextData))) throw new Error("Saved data verification failed.");
    }
  };
}
export async function createRecoveryBackup(data, recoveryPassword) {
  if (String(recoveryPassword).length < 12) throw new Error("Recovery password must have at least 12 characters.");
  const salt = randomBytes(16), key = await deriveKey(recoveryPassword, salt);
  const encrypted = await encryptBytes(key, encoder.encode(JSON.stringify(normaliseData(data))));
  return JSON.stringify({ format: FORMAT, version: 1, kdf: "PBKDF2-SHA-256", iterations: ITERATIONS, salt: bytesToBase64(salt), ...encrypted }, null, 2);
}
export async function restoreRecoveryBackup(jsonText, recoveryPassword) {
  let backup;
  try { backup = JSON.parse(jsonText); } catch { throw new Error("Backup file is not valid JSON."); }
  if (backup?.format !== FORMAT || backup.version !== 1) throw new Error("This is not a supported encrypted MyFinance recovery backup.");
  let key;
  try { key = await deriveKey(recoveryPassword, base64ToBytes(backup.salt)); }
  catch { throw new Error("Could not read the recovery backup."); }
  try { return normaliseData(JSON.parse(decoder.decode(await decryptBytes(key, backup)))); }
  catch { throw new Error("Recovery password is incorrect or the backup file is damaged."); }
}
export async function migrateLegacyData({ pin, recoveryPassword, downloadBackup }) {
  if (await dbGet()) throw new Error("Secure storage is already set up.");
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) throw new Error("No existing MyFinance records were found in this browser.");
  let legacy;
  try { legacy = normaliseData(JSON.parse(raw)); }
  catch { throw new Error("Existing records could not be read. They have not been changed."); }
  const backupText = await createRecoveryBackup(legacy, recoveryPassword);
  await downloadBackup(backupText);
  const backupCheck = await restoreRecoveryBackup(backupText, recoveryPassword);
  if (JSON.stringify(backupCheck) !== JSON.stringify(legacy)) throw new Error("Recovery backup verification failed. Original records are untouched.");
  const result = await createVault(legacy, pin, recoveryPassword);
  const unlocked = await unlockVault(pin, "pin");
  if (JSON.stringify(unlocked.data) !== JSON.stringify(legacy)) {
    await dbDelete();
    throw new Error("Migration verification failed. Original records are untouched.");
  }
  // Delete plaintext only after backup download, encrypted write, and read-back verification.
  localStorage.removeItem(LEGACY_KEY);
  return result;
}
export async function initialiseNewVault({ data, pin, recoveryPassword, downloadBackup }) {
  const backupText = await createRecoveryBackup(data, recoveryPassword);
  await downloadBackup(backupText);
  return createVault(data, pin, recoveryPassword);
}
export async function restoreIntoVault({ jsonText, recoveryPassword, newPin, downloadBackup }) {
  validateCredentials(newPin, recoveryPassword);
  const restored = await restoreRecoveryBackup(jsonText, recoveryPassword);
  const freshBackup = await createRecoveryBackup(restored, recoveryPassword);
  await downloadBackup(freshBackup);
  if (await dbGet()) await dbDelete();
  return createVault(restored, newPin, recoveryPassword);
}
export async function removeVault() { await dbDelete(); }
export const VAULT_CONSTANTS = Object.freeze({ DB_NAME, STORE_NAME, LEGACY_KEY, ITERATIONS, FORMAT });
