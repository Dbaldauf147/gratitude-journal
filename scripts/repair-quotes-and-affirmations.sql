-- Makes the daily view's Quote and Affirmation cards actually save.
--
-- Both had been silently doing nothing, for two different reasons, since the
-- code that writes them was added. Neither user had a single saved row.
--
-- Safe to run more than once.

-- 1. Quotes: the table existed, but authenticated could not touch it.
--
-- This database's default privileges hand anon/authenticated only Dxtm
-- (references/trigger/truncate) on new tables in public, so every insert from
-- the browser failed with "permission denied for table quotes". The failure
-- was invisible because loadQuotes/handleQuote ignore the error.
grant select, insert, update, delete on table public.quotes to authenticated;

-- 2. Affirmations: the table was never created at all.
--
-- src/app/dashboard/page.tsx queries `affirmations` in loadAffirmations and
-- handleAffirmation. Columns below are exactly what that code reads and
-- writes — same shape as quotes, minus the author.
create table if not exists public.affirmations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  approved boolean default false not null,
  dismissed boolean default false not null,
  shown_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_affirmations_user_id on public.affirmations(user_id);
-- handleAffirmation looks up by (text, shown_at within today), and
-- loadAffirmations orders by shown_at.
create index if not exists idx_affirmations_shown_at on public.affirmations(user_id, shown_at desc);

alter table public.affirmations enable row level security;

grant select, insert, update, delete on table public.affirmations to authenticated;

drop policy if exists "Users can view their own affirmations" on public.affirmations;
create policy "Users can view their own affirmations"
  on public.affirmations for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own affirmations" on public.affirmations;
create policy "Users can insert their own affirmations"
  on public.affirmations for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own affirmations" on public.affirmations;
create policy "Users can update their own affirmations"
  on public.affirmations for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own affirmations" on public.affirmations;
create policy "Users can delete their own affirmations"
  on public.affirmations for delete using (auth.uid() = user_id);
