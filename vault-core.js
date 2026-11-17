/* MyFinance local vault cryptography. No network calls. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MyFinanceVaultCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const ITERATIONS = 310000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const bytesToB64 = b => {
    let s = ''; new Uint8Array(b).forEach(v => { s += String.fromCharCode(v); });
    return btoa(s);
  };
  const b64ToBytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const random = (crypto, n) => crypto.getRandomValues(new Uint8Array(n));
  async function derive(password, salt, crypto) {
    const material = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:ITERATIONS, hash:'SHA-256'}, material, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
  }
  async function seal(key, bytes, crypto) {
    const iv = random(crypto, 12);
    const cipher = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, bytes);
    return {iv:bytesToB64(iv), cipher:bytesToB64(cipher)};
  }
  async function open(key, box, crypto) {
    return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM', iv:b64ToBytes(box.iv)}, key, b64ToBytes(box.cipher)));
  }
  function validData(data) {
    return !!data && typeof data === 'object' && Array.isArray(data.transactions) &&
      data.budgets && typeof data.budgets === 'object' &&
      Array.isArray(data.goals) && Array.isArray(data.recurring) &&
      data.settings && typeof data.settings === 'object';
  }
  async function createRecord(data, pin, recovery, crypto) {
    if (!/^\d{6,12}$/.test(pin)) throw new Error('PIN must contain 6 to 12 digits.');
    if (typeof recovery !== 'string' || recovery.trim().length < 14) throw new Error('Recovery password must be at least 14 characters.');
    if (!validData(data)) throw new Error('Finance data did not pass validation.');
    const masterRaw = random(crypto, 32);
    const master = await crypto.subtle.importKey('raw', masterRaw, {name:'AES-GCM'}, true, ['encrypt','decrypt']);
    const pinSalt = random(crypto, 16), recoverySalt = random(crypto, 16);
    const pinKey = await derive(pin, pinSalt, crypto);
    const recoveryKey = await derive(recovery.trim(), recoverySalt, crypto);
    const pinBox = await seal(pinKey, masterRaw, crypto);
    const recoveryBox = await seal(recoveryKey, masterRaw, crypto);
    const dataBox = await seal(master, enc.encode(JSON.stringify(data)), crypto);
    return {
      format:'myfinance-encrypted-backup', version:VERSION, iterations:ITERATIONS,
      pinSalt:bytesToB64(pinSalt), recoverySalt:bytesToB64(recoverySalt),
      pinWrap:pinBox, recoveryWrap:recoveryBox, payload:dataBox,
      updatedAt:new Date().toISOString()
    };
  }
  async function unwrap(record, secret, mode, crypto) {
    if (!record || record.format !== 'myfinance-encrypted-backup' || record.version !== VERSION) throw new Error('Unsupported or invalid encrypted backup.');
    const salt = b64ToBytes(mode === 'pin' ? record.pinSalt : record.recoverySalt);
    const box = mode === 'pin' ? record.pinWrap : record.recoveryWrap;
    const key = await derive(secret, salt, crypto);
    try {
      const raw = await open(key, box, crypto);
      return crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, true, ['encrypt','decrypt']);
    } catch (_) { throw new Error(mode === 'pin' ? 'Incorrect PIN.' : 'Incorrect recovery password.'); }
  }
  async function decryptRecord(record, secret, mode, crypto) {
    const master = await unwrap(record, secret, mode, crypto);
    try {
      const plain = await open(master, record.payload, crypto);
      const data = JSON.parse(dec.decode(plain));
      if (!validData(data)) throw new Error('Finance data structure is invalid.');
      return {data, master};
    } catch (e) {
      if (e && /structure is invalid/.test(e.message)) throw e;
      throw new Error('The encrypted finance data could not be verified.');
    }
  }
  async function changePin(record, oldSecret, newPin, mode, crypto) {
    if (!/^\d{6,12}$/.test(newPin)) throw new Error('New PIN must contain 6 to 12 digits.');
    const master = await unwrap(record, oldSecret, mode, crypto);
    const raw = await crypto.subtle.exportKey('raw', master);
    const salt = random(crypto, 16);
    const key = await derive(newPin, salt, crypto);
    const box = await seal(key, new Uint8Array(raw), crypto);
    return Object.assign({}, record, {pinSalt:bytesToB64(salt), pinWrap:box, updatedAt:new Date().toISOString()});
  }
  return {VERSION, ITERATIONS, validData, createRecord, decryptRecord, changePin};
});
