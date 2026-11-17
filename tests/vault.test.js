import test from "node:test";
import assert from "node:assert/strict";
import { createRecoveryBackup, restoreRecoveryBackup, VAULT_CONSTANTS } from "../src/vault.js";
const sample = {
  transactions: [{ id: "tx-1", type: "expense", amount: 1250, date: "2026-11-01", category: "Food" }],
  budgets: { Food: 5000 },
  goals: [{ id: "g1", name: "Emergency", target: 50000, saved: 12000 }],
  recurring: [{ id: "r1", name: "Rent", amount: 8000, frequency: "Monthly", date: "2026-12-01" }],
  settings: { theme: "dark", budgetAlert: true, billAlert: false }
};
test("encrypted recovery backup restores every existing data group", async () => {
  const text = await createRecoveryBackup(sample, "correct-horse-battery-9");
  const restored = await restoreRecoveryBackup(text, "correct-horse-battery-9");
  assert.deepEqual(restored, sample);
});
test("wrong recovery password is rejected", async () => {
  const text = await createRecoveryBackup(sample, "correct-horse-battery-9");
  await assert.rejects(() => restoreRecoveryBackup(text, "wrong-password-000"), /incorrect|damaged/i);
});
test("damaged backup is rejected", async () => {
  const text = await createRecoveryBackup(sample, "correct-horse-battery-9");
  const parsed = JSON.parse(text);
  parsed.ciphertext = parsed.ciphertext.slice(0, -4) + "AAAA";
  await assert.rejects(() => restoreRecoveryBackup(JSON.stringify(parsed), "correct-horse-battery-9"));
});
test("backup format and work factor are versioned", () => {
  assert.equal(VAULT_CONSTANTS.FORMAT, "myfinance-encrypted-backup-v1");
  assert.equal(VAULT_CONSTANTS.ITERATIONS, 600000);
});
