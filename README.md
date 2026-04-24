# Compliance Screening Tool

Upload a building portfolio and screen it against every applicable energy
benchmarking, audit / retro-commissioning, Building Performance Standard
(BPS), and whole-building utility data feed mandate — by city and state.

## What it does

- **Upload buildings** as CSV (`address`, `city`, `state`, `zip`, `sqft`,
  optional `name` / `property_type`).
- **Upload jurisdiction lookups** (cities, counties, states) and **mandate
  lookups** (one row per ordinance / statute) as CSVs.
- **Screen each building**: for every mandate tied to the building's
  `(city, state)` or `state`-level jurisdiction, the tool checks the sqft
  threshold and property-type filter and reports whether the building is
  in scope, with the next deadline and a link to the source.

## Tech stack

- Next.js 14 (App Router) + TypeScript
- Supabase (Postgres + Auth) with Row Level Security
- Tailwind CSS

## Setup

1. `npm install`
2. Create a Supabase project and run `supabase-schema.sql` in the SQL Editor.
3. Copy `.env.local.example` → `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. `npm run dev` and visit http://localhost:3000.

## Usage

1. Sign up, then go to **Lookups** and upload a `jurisdictions` CSV (template
   linked on the page), then a `mandates` CSV (mandates reference jurisdictions
   by `slug`).
2. Go to **Portfolio → Upload** and upload a buildings CSV.
3. The portfolio view shows a matrix of applicable mandates by type per
   building. Click any row for the full compliance detail with deadlines,
   thresholds, and citations.

## Data model

- `jurisdictions` — `(slug, name, level, city, county, state, notes)`
- `mandates` — `(jurisdiction_id, type, name, citation, sqft_threshold,
  property_types[], first_due, cadence, source_url, notes)` where `type` is
  one of `benchmarking`, `audit`, `bps`, `utility_data_feed`.
- `buildings` — `(name, address, city, state, zip, sqft, property_type,
  uploaded_by)`.

All three tables are shared across authenticated users. See
`supabase-schema.sql` for the RLS policies.

## Screening logic

For each building, match on `(city, state)` for city/county-level
jurisdictions and on `state` for state-level jurisdictions. For each matched
mandate, check:

1. `sqft >= sqft_threshold` (or threshold is null).
2. If `property_types` is set and the building has a `property_type`, it must
   match (case-insensitive).

Buildings that fail these checks still appear in the detail view but are
marked **Does not apply** with the reason shown.
