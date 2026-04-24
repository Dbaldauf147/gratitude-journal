-- Compliance Screening Tool — Database Schema
-- Run this in the Supabase SQL Editor.
--
-- Data is SHARED across authenticated users. Any signed-in user can read
-- and contribute to buildings, jurisdictions, and mandates. If you need
-- per-user privacy later, scope RLS by uploaded_by.

-- ---------- Drop legacy journal table if it exists ----------
drop table if exists gratitude_entries cascade;

-- ---------- Jurisdictions ----------
create table if not exists jurisdictions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,                    -- display name, e.g. "New York City, NY"
  level text not null check (level in ('state','county','city','other')),
  city text,
  county text,
  state text not null,                   -- USPS 2-letter code
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_jurisdictions_city_state
  on jurisdictions (lower(city), upper(state));
create index if not exists idx_jurisdictions_state
  on jurisdictions (upper(state));

-- ---------- Mandates ----------
create table if not exists mandates (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid not null references jurisdictions(id) on delete cascade,
  type text not null check (type in ('benchmarking','audit','bps','utility_data_feed')),
  name text not null,                    -- e.g. "NYC Local Law 84"
  citation text,                         -- statute or ordinance reference
  sqft_threshold integer,                -- nullable = applies at any size
  property_types text[],                 -- nullable/empty = all property types
  first_due date,                        -- first / next deadline (ISO yyyy-mm-dd)
  cadence text,                          -- free text: "annual", "every 5 years"
  source_url text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mandates_jurisdiction on mandates (jurisdiction_id);
create index if not exists idx_mandates_type on mandates (type);

-- ---------- Buildings ----------
create table if not exists buildings (
  id uuid primary key default gen_random_uuid(),
  name text,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  sqft integer not null,
  property_type text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_buildings_city_state
  on buildings (lower(city), upper(state));
create index if not exists idx_buildings_uploaded_by on buildings (uploaded_by);

-- ---------- Row Level Security ----------
alter table jurisdictions enable row level security;
alter table mandates      enable row level security;
alter table buildings     enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'jurisdictions_read') then
    create policy jurisdictions_read on jurisdictions
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'jurisdictions_write') then
    create policy jurisdictions_write on jurisdictions
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'mandates_read') then
    create policy mandates_read on mandates
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'mandates_write') then
    create policy mandates_write on mandates
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'buildings_read') then
    create policy buildings_read on buildings
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'buildings_insert') then
    create policy buildings_insert on buildings
      for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'buildings_delete_own') then
    create policy buildings_delete_own on buildings
      for delete to authenticated using (uploaded_by = auth.uid());
  end if;
end $$;
