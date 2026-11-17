-- MyFinance cloud database setup for Supabase
-- Run this in Supabase Dashboard > SQL Editor.
create table if not exists public.user_finance_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_finance_data enable row level security;
drop policy if exists "Users can read their own finance data" on public.user_finance_data;
create policy "Users can read their own finance data"
on public.user_finance_data for select to authenticated
using (auth.uid() = user_id);
drop policy if exists "Users can insert their own finance data" on public.user_finance_data;
create policy "Users can insert their own finance data"
on public.user_finance_data for insert to authenticated
with check (auth.uid() = user_id);
drop policy if exists "Users can update their own finance data" on public.user_finance_data;
create policy "Users can update their own finance data"
on public.user_finance_data for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.user_finance_data to authenticated;
