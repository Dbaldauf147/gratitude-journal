// GET /api/gratitude-today — exports how many of today's 3 gratitude lines are
// logged, so Prep Day's Habits page can show it and auto-log a habit. Mirrors the
// dashboard's `todayCount` (0/3 → 3/3): a saved gratitude_entries row = 3 (all
// three lines are required to save), no row = 0.
//
// This is a cross-app, server-to-server call with no user session, so it uses a
// SERVICE-ROLE Supabase client (bypasses RLS) and is guarded by a shared secret
// (?key= matched to GRATITUDE_EXPORT_KEY), same shape as Rally's plans-export.
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const GRATITUDE_GOAL = 3;

// Bucket a timestamp into its America/New_York calendar date (YYYY-MM-DD), so
// "today" matches the user's local clock the way the dashboard does. DST-safe.
function etDateStr(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const expected = (process.env.GRATITUDE_EXPORT_KEY || '').trim();
  if (!expected) {
    // null (not 0) so Prep Day hides the tile / skips the rule rather than
    // showing a misleading "0/3" when the bridge simply isn't configured.
    return NextResponse.json({ loggedCount: null, goal: GRATITUDE_GOAL, reason: 'No GRATITUDE_EXPORT_KEY configured' });
  }
  if ((url.searchParams.get('key') || '').trim() !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ loggedCount: null, goal: GRATITUDE_GOAL, reason: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }

  // Caller passes its local day; fall back to the server's ET day.
  let date = (url.searchParams.get('date') || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = etDateStr(new Date());

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Fetch a 48h window around the target day (created_at is stored UTC), then
  // bucket by ET date in JS so the DST offset never causes an off-by-one.
  const dayMs = 86400000;
  const anchor = new Date(`${date}T12:00:00Z`).getTime();
  const lo = new Date(anchor - dayMs).toISOString();
  const hi = new Date(anchor + dayMs).toISOString();

  let query = admin
    .from('gratitude_entries')
    .select('user_id, grateful_1, grateful_2, grateful_3, created_at')
    .gte('created_at', lo)
    .lte('created_at', hi);

  // Personal app: optionally pin to one user if GRATITUDE_USER_ID is set.
  const userId = (process.env.GRATITUDE_USER_ID || '').trim();
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ loggedCount: null, goal: GRATITUDE_GOAL, date, reason: error.message });
  }

  // Of the rows that fall on the target ET day, take the most-complete one.
  let loggedCount = 0;
  for (const r of data || []) {
    if (etDateStr(new Date(r.created_at as string)) !== date) continue;
    const n = [r.grateful_1, r.grateful_2, r.grateful_3].filter((s) => (s || '').toString().trim()).length;
    if (n > loggedCount) loggedCount = n;
  }

  return NextResponse.json({ loggedCount, goal: GRATITUDE_GOAL, date });
}
