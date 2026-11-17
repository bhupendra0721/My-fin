# MyFinance

A mobile-first personal finance app designed for Android, desktop and mobile browsers.

## Features
- Monthly dashboard: income, expenses, balance, savings rate and six-month trend
- Income and expense transactions with categories, search, filters, edit and delete
- Category budgets with 80% and 100% warning colours
- Savings goals and progress tracking
- Monthly reports, category summaries, CSV export, JSON backup/restore and print-to-PDF
- Local finance assistant that answers from saved records only
- Dark/light mode, recurring payment schedules and EMI category tracking
- Installable PWA and offline app shell
- Optional Supabase account and cloud sync between devices

## Run the app
Open `index.html` in a modern browser or deploy this repository using GitHub Pages. For Android, open the HTTPS site in Chrome and choose Install app / Add to Home screen.

## Set up cloud sync
1. Create a Supabase project at https://supabase.com/.
2. Open SQL Editor and run all of `supabase/schema.sql`.
3. In Project Settings > API, copy the Project URL and anon/publishable key.
4. In MyFinance > Settings & sync, save those values, create an account, then sign in.
5. Open the deployed app on another device and sign in using the same account.

Only use the public anon/publishable key in the browser. Never use a service-role key in this app. Row Level Security ensures each signed-in user can access only their own row.

## Important limitations
- Until cloud sync is configured, data is stored in this browser only. Back up before changing devices or clearing browser data.
- The first sync asks whether to load existing cloud data or upload this device's data. Make a backup first and choose carefully.
- Sync runs after saved changes and on sign-in; this is not real-time collaborative editing.
- The assistant is rule-based, not a connected generative AI service.
- Recurring schedules are stored for reference; automatic payment creation, push notifications, bank connections and SMS reading are not included yet.
