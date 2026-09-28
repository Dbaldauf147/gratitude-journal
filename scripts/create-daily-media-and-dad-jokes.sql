-- Storage for the dashboard's daily photo/video, and the table behind the
-- dad-joke card. Safe to re-run: every create is "if not exists"/"on conflict",
-- and each policy is dropped before it's recreated.

-- ── Daily media ──────────────────────────────────────────────────────────────
-- A private bucket. Files live at `<user id>/<YYYY-MM-DD>/<name>`, so "what did
-- I upload on this day" is a folder listing — no table to keep in step with the
-- files. The day is the uploader's LOCAL date, chosen by the browser.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('daily-media', 'daily-media', false, 52428800, array['image/*', 'video/*'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The first path segment is the owner, so each policy checks it against the
-- caller. That's the whole access model: nobody reads another person's folder.
drop policy if exists "daily-media: read own" on storage.objects;
create policy "daily-media: read own" on storage.objects for select to authenticated
  using (bucket_id = 'daily-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "daily-media: upload own" on storage.objects;
create policy "daily-media: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'daily-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "daily-media: delete own" on storage.objects;
create policy "daily-media: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'daily-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Dad jokes ────────────────────────────────────────────────────────────────
-- One row per joke the user has ruled on. `saved` true = kept, false = thrown
-- away. Jokes with no row are still unseen, which is what the picker offers.
create table if not exists public.dad_jokes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  saved boolean not null,
  created_at timestamptz default now() not null
);

create unique index if not exists idx_dad_jokes_user_text on public.dad_jokes(user_id, text);

alter table public.dad_jokes enable row level security;

-- Required on this database: default privileges give anon/authenticated only
-- Dxtm on new tables, so without this the app gets "permission denied".
grant select, insert, update, delete on table public.dad_jokes to authenticated;

drop policy if exists "Users can view their own dad jokes" on public.dad_jokes;
create policy "Users can view their own dad jokes"
  on public.dad_jokes for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own dad jokes" on public.dad_jokes;
create policy "Users can insert their own dad jokes"
  on public.dad_jokes for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own dad jokes" on public.dad_jokes;
create policy "Users can update their own dad jokes"
  on public.dad_jokes for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own dad jokes" on public.dad_jokes;
create policy "Users can delete their own dad jokes"
  on public.dad_jokes for delete using (auth.uid() = user_id);
