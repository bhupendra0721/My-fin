# MyFinance

A private, device-only personal finance app for Android and desktop browsers.

## Current features

- Monthly dashboard: income, expenses, balance, savings rate and six-month trend
- Income and expense transactions with categories, search, filters, edit and delete
- Category budgets, savings goals and recurring payment schedules
- Monthly reports, category summaries, CSV export and print-to-PDF
- Local rule-based finance assistant (not a connected AI service)
- Dark/light mode and installable PWA shell
- Encrypted local finance vault using AES-GCM
- PIN unlock, recovery-password unlock and automatic privacy lock
- Password-protected encrypted JSON backup and restore

## Privacy and storage

- Finance records are stored in this browser's IndexedDB on this device.
- Records are encrypted with AES-GCM. A key is protected separately by your PIN and recovery password using PBKDF2-SHA-256.
- The app does not sync finance records to Supabase or another cloud service. It does not send records to an AI service.
- The app locks after five minutes without activity and when the page is hidden.
- Use the HTTPS GitHub Pages site in a modern browser. Web Crypto and IndexedDB are required.

## First-time secure migration

1. Open the app on the same browser and device where your current MyFinance records are stored.
2. Create a PIN of 6–12 digits and a separate recovery password of at least 14 characters.
3. Keep the recovery password somewhere safe and separate from the device.
4. The app reads the old `myfinance-v3` localStorage data without changing it, encrypts a copy in IndexedDB, and verifies the encrypted copy.
5. The app downloads an encrypted recovery backup. Save that file and confirm that you have saved it.
6. Only after your confirmation does the app remove the old unencrypted localStorage copy.

If setup is interrupted before the final confirmation, the old copy is retained. Unlock the encrypted vault on the next visit, save a fresh encrypted backup, and finish the migration cleanup.

## Backup and recovery

- Use **Download backup** in Settings to export an encrypted JSON backup.
- To restore an encrypted backup, choose the file and enter the recovery password used when it was created.
- Older unencrypted JSON backups are also accepted; the app imports them into the currently unlocked encrypted vault.
- Keep the recovery password and encrypted backup together in a safe place, but do not store the password inside the backup file.
- If you lose both your PIN and recovery password, the encrypted records cannot be recovered. There is no cloud-based password reset.
- Clearing browser data, uninstalling the browser, or changing browser profiles can remove the local vault. Keep an external backup.

## Rollback and safety

- Phase 1 changes are being developed on the `phase-1-local-encryption` branch. The existing `main` branch remains the rollback version until changes are reviewed and merged.
- Migration is non-destructive until the encrypted copy has been verified and the user confirms saving the recovery backup.
- The legacy localStorage key is retained if migration is interrupted before the final step.
- The old Supabase SQL file is retained for reference only; the app no longer contains a cloud connection or sync flow.

## Tests

Run the cryptography tests with Node.js 20 or newer:

```bash
node --test tests/vault.test.cjs
```

The GitHub Actions test workflow also checks the inline app JavaScript syntax. No production deployment is triggered by the Phase 1 branch.

## Deployment

GitHub Pages deployment is configured in `.github/workflows/deploy.yml` and runs only when changes are pushed to `main`. The Phase 1 branch does not deploy to the live site.
