# MyFinance

A mobile-first, installable personal finance tracker for a single user.

## Included in this first working version
- Dashboard totals and six-month income/expense trend
- Add, edit, delete, search and filter transactions
- Monthly category budgets with 50%, 80% and 100% indicators
- Savings goals and progress tracking
- Data-based finance assistant for common questions
- Monthly CSV export (Excel-compatible), print-to-PDF, JSON backup and restore
- Light/dark theme and offline app shell

## Run it
Open `index.html` in a modern browser or publish the repository with GitHub Pages. For Android, open the deployed HTTPS site in Chrome and choose **Install app** / **Add to Home screen**.

## Privacy and limitations
This version stores records in the browser's localStorage on the device. It has no bank connection, cloud sync, account login, or server-side encryption. Do not clear browser storage unless you have a backup. Export a JSON backup regularly. The assistant uses transparent local rules and recorded app data; it is not a connected generative-AI service and does not make verified affordability decisions. CSV is Excel-compatible; use the browser print dialog to save reports as PDF.

## Suggested next development steps
1. Add device-level authentication and encrypted database storage.
2. Add recurring transactions, bill reminders, EMI schedules and notification permissions.
3. Add secure optional cloud backup and restore.
4. Add an AI provider integration only after choosing a provider and protecting its API key on a backend.
5. Add automated tests for calculations and import/export.
