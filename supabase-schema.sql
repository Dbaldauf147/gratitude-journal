-- Gratitude Journal Database Schema
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- Create the gratitude entries table
create table if not exists gratitude_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  grateful_1 text not null,
  grateful_2 text not null,
  grateful_3 text not null,
  created_at timestamptz default now() not null
);

-- Index for fast user lookups
create index if not exists idx_gratitude_user_id on gratitude_entries(user_id);
create index if not exists idx_gratitude_created_at on gratitude_entries(created_at desc);

-- Row Level Security: users can only see/edit their own entries
alter table gratitude_entries enable row level security;

create policy "Users can view their own entries"
  on gratitude_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert their own entries"
  on gratitude_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own entries"
  on gratitude_entries for delete
  using (auth.uid() = user_id);

-- Quotes (calendar-sourced; track which ones the user keeps vs dismisses)
create table if not exists public.quotes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  author text,
  approved boolean default false not null,
  dismissed boolean default false not null,
  shown_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_quotes_user_id on public.quotes(user_id);

alter table public.quotes enable row level security;

create policy "Users can view their own quotes"
  on public.quotes for select using (auth.uid() = user_id);

create policy "Users can insert their own quotes"
  on public.quotes for insert with check (auth.uid() = user_id);

create policy "Users can update their own quotes"
  on public.quotes for update using (auth.uid() = user_id);

create policy "Users can delete their own quotes"
  on public.quotes for delete using (auth.uid() = user_id);

-- Jokes (imported from a Google Calendar export, then rated by hand).
-- `rating` is null until reviewed, which is what the review queue looks for.
create table if not exists public.jokes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  punchline text,
  rating text check (rating in ('sfw', 'nsfw')),
  -- The calendar event's UID, so re-importing the same file doesn't duplicate.
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

-- Required: this database's default privileges give anon/authenticated only
-- Dxtm on new tables, so without this the app gets "permission denied for
-- table jokes" despite correct RLS. See scripts/create-jokes-table.sql.
grant select, insert, update, delete on table public.jokes to authenticated;

create policy "Users can view their own jokes"
  on public.jokes for select using (auth.uid() = user_id);

create policy "Users can insert their own jokes"
  on public.jokes for insert with check (auth.uid() = user_id);

create policy "Users can update their own jokes"
  on public.jokes for update using (auth.uid() = user_id);

create policy "Users can delete their own jokes"
  on public.jokes for delete using (auth.uid() = user_id);
