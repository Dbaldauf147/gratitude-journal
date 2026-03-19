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
