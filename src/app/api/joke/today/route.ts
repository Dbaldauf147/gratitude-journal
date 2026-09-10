// GET /api/joke/today — one SFW joke for the day, for the dashboard's daily view.
//
// The jokes belong to one account and RLS scopes them to their owner, so another
// signed-in user can't read them directly. Rather than loosening that policy for
// the whole table, this route reads with a SERVICE-ROLE client and hands back a
// single joke — and only ever one that's been rated `sfw`. Unrated jokes are
// never served: an unreviewed joke is an unknown joke.
//
// A session is required, so this isn't an open endpoint; the browser's cookies
// are the credential, which is why there's no shared secret like the
// cross-app export routes have.
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ joke: null, reason: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Ordered by id so the sequence is stable between requests — without an
  // explicit order, "the third joke" could be a different row each time.
  const { data, error } = await admin
    .from('jokes')
    .select('text, punchline')
    .eq('rating', 'sfw')
    .order('id', { ascending: true });

  if (error) return NextResponse.json({ joke: null, reason: error.message });

  const jokes = data || [];
  if (!jokes.length) return NextResponse.json({ joke: null, count: 0 });

  // The caller passes its own local day, so the joke turns over at the reader's
  // midnight rather than the server's. Days-since-epoch means consecutive days
  // walk the list in order instead of landing at random.
  const date = (new URL(req.url).searchParams.get('date') || '').trim();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86400000)
    : Math.floor(Date.now() / 86400000);

  return NextResponse.json({
    joke: jokes[((day % jokes.length) + jokes.length) % jokes.length],
    count: jokes.length,
  });
}
