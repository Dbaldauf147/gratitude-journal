-- Creates the table behind the dashboard's Jokes tab.
--
-- Paste the whole file into the Supabase SQL Editor and press Run. Safe to run
-- more than once: the table and indexes are "if not exists", and each policy is
-- dropped before it's recreated (plain CREATE POLICY errors if one already
-- exists, which is what makes re-running supabase-schema.sql fail partway).

create table if not exists public.jokes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  punchline text,
  rating text check (rating in ('sfw', 'nsfw')),
  -- The calendar event's UID, so re-importing the same export doesn't duplicate.
  uid text,
  event_date date,
  created_at timestamptz default now() not null
);

create index if not exists idx_jokes_user_id on public.jokes(user_id);
create index if not exists idx_jokes_rating on public.jokes(user_id, rating);

-- One row per calendar event per user. Postgres treats nulls as distinct, so
-- this constrains only the events that actually carried a UID.
create unique index if not exists idx_jokes_user_uid on public.jokes(user_id, uid);

alter table public.jokes enable row level security;

-- Not optional here, and not the usual Supabase boilerplate.
--
-- This database has a default-privileges rule that hands anon and authenticated
-- only Dxtm (references/trigger/truncate) on new tables, so a table created
-- without this grant is invisible to the app: PostgREST reports "permission
-- denied for table jokes" even though RLS is set up correctly. gratitude_entries
-- predates that rule and has grants; anything newer has to ask.
--
-- anon is deliberately left out — the dashboard is behind auth, and RLS still
-- scopes every row to its owner.
grant select, insert, update, delete on table public.jokes to authenticated;

drop policy if exists "Users can view their own jokes" on public.jokes;
create policy "Users can view their own jokes"
  on public.jokes for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own jokes" on public.jokes;
create policy "Users can insert their own jokes"
  on public.jokes for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own jokes" on public.jokes;
create policy "Users can update their own jokes"
  on public.jokes for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own jokes" on public.jokes;
create policy "Users can delete their own jokes"
  on public.jokes for delete using (auth.uid() = user_id);
