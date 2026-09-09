# Gratitude Journal — working notes

## Git workflow

**Every requested change ships as its own PR.** For each user request that produces code changes:

1. Create a fresh feature branch off the latest `master`. Use `claude/<short-kebab-slug>` for the name — pick a slug that describes the change (e.g. `claude/korean-phrase-entry`, `claude/entry-streak-fix`).
2. Commit on that branch and push it with `git push -u origin <branch>`.
3. Open the PR. Prefer the GitHub API (`mcp__github__create_pull_request`) when it's available; if it fails, fall back to printing the compare URL: `https://github.com/Dbaldauf147/gratitude-journal/pull/new/<branch>`.
4. **Merge it yourself** (`mcp__github__merge_pull_request`) once the work is verified — the user asked for this rather than being handed a link each time. Report the merge commit instead. Verification doesn't get lighter for being faster: see below for what it means here. If the branch conflicts or the change turns out riskier than it looked, fix that first rather than merging and explaining afterwards. Still stop and ask on anything destructive or genuinely ambiguous.
5. Don't push directly to `master`. Everything lands through a PR.

Branches stay one-PR-per-change so each fix can be reviewed and merged independently — don't pile unrelated changes onto a previous branch.

## Verifying before you merge

There is no test suite and no CI, so the build is the gate — and on a strict-mode TypeScript Next app it is a real one:

    npm run build     # next build — typechecks, and fails on a bad import or a bad server/client boundary
    npm run lint      # next lint

`npm run build` is the check that catches the mistake this stack makes easiest: a server-only import (the Supabase service client, `next/headers`) pulled into a client component, or the reverse. It fails at build time, which is the last cheap place to find it.

Then **check the actual behaviour**. Chromium and Playwright are available: run `npm run dev`, drive the page and assert on what you changed. Anything behind auth needs a Supabase session, so either seed one or exercise the piece below the auth boundary directly rather than reporting "it renders" from a redirect to the login page.

Supabase is a live shared database, not a fixture. Read freely; before writing, know whether the row you're about to change is the user's real journal.

## Deploys

Vercel builds `master` on every merge — this is a Next.js app on Vercel's Git integration, and `next.config.mjs` bakes `VERCEL_URL` into the bundle as `NEXT_PUBLIC_DEPLOY_ID` so an open tab can notice a newer deploy has shipped (that's what the update pill compares against `/api/version`). A merged PR is live within a couple of minutes.

What that build does **not** ship:

- **The database.** `supabase-schema.sql` is the schema as it should be; applying it — and any migration a change needs — happens in Supabase, by hand. Code that reads a column nobody has added yet deploys perfectly and fails at runtime, so when a change needs schema, say so in the PR and don't merge it ahead of the migration.
- **Environment variables** — the Supabase URL and keys, and the Anthropic key, live in Vercel → Settings → Environment Variables. A new one is not shipped by merging the code that reads it.
