"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { parseICS, icsDate } from "@/lib/ics";

type Rating = "sfw" | "nsfw";
type Filter = "all" | Rating | "unrated";

interface Joke {
  id: string;
  text: string;
  punchline: string | null;
  rating: Rating | null;
  uid: string | null;
  event_date: string | null;
  created_at: string;
}

/** What we key on to avoid importing the same joke twice. */
const dedupeKey = (j: { uid?: string | null; text: string }) =>
  j.uid ? `uid:${j.uid}` : `text:${j.text.trim().toLowerCase()}`;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "unrated", label: "To review" },
  { key: "sfw", label: "SFW" },
  { key: "nsfw", label: "NSFW" },
  { key: "all", label: "All" },
];

export default function JokesTab({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);

  const [jokes, setJokes] = useState<Joke[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("unrated");
  const [importing, setImporting] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("jokes")
      .select("*")
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) {
      // Worth saying out loud: until the jokes table is created, this reads as
      // an empty collection rather than a setup step that hasn't happened.
      setNote(
        error.message.includes("does not exist")
          ? "The jokes table isn't in Supabase yet — run the jokes block from supabase-schema.sql in the SQL Editor."
          : "Couldn't load your jokes. Check your connection."
      );
    } else {
      setJokes((data as Joke[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const unrated = jokes.filter((j) => !j.rating);
  const sfwCount = jokes.filter((j) => j.rating === "sfw").length;
  const nsfwCount = jokes.filter((j) => j.rating === "nsfw").length;

  // The review queue is just the front of the unrated list — rating a joke
  // removes it from the queue, so the next one slides up on its own.
  const current = unrated[0];

  const visible = useMemo(() => {
    if (filter === "all") return jokes;
    if (filter === "unrated") return unrated;
    return jokes.filter((j) => j.rating === filter);
  }, [jokes, unrated, filter]);

  async function rate(id: string, rating: Rating) {
    // Move it in the UI first; the queue should never wait on the network.
    setJokes((prev) => prev.map((j) => (j.id === id ? { ...j, rating } : j)));
    const { error } = await supabase.from("jokes").update({ rating }).eq("id", id);
    if (error) {
      setJokes((prev) => prev.map((j) => (j.id === id ? { ...j, rating: null } : j)));
      setNote("Couldn't save that rating. Check your connection.");
    }
  }

  async function remove(id: string) {
    const gone = jokes.find((j) => j.id === id);
    setJokes((prev) => prev.filter((j) => j.id !== id));
    const { error } = await supabase.from("jokes").delete().eq("id", id);
    if (error && gone) {
      setJokes((prev) => [...prev, gone]);
      setNote("Couldn't delete that one.");
    }
  }

  async function importFile(file: File) {
    setImporting(true);
    setNote("");
    try {
      const events = parseICS(await file.text());

      const have = new Set(jokes.map(dedupeKey));
      const rows: {
        user_id: string;
        text: string;
        punchline: string | null;
        uid: string | null;
        event_date: string | null;
      }[] = [];

      for (const e of events) {
        // The joke is the event title; anything in the body rides along as the
        // punchline, which is often where the second half lives.
        const text = (e.summary || "").trim();
        if (!text) continue;
        const key = dedupeKey({ uid: e.uid, text });
        if (have.has(key)) continue;
        have.add(key);
        rows.push({
          user_id: userId,
          text,
          punchline: (e.description || "").trim() || null,
          uid: e.uid || null,
          event_date: icsDate(e.dtstart),
        });
      }

      if (!events.length) {
        setNote("No calendar events in that file — is it the .ics from the export?");
      } else if (!rows.length) {
        setNote(`Nothing new — all ${events.length} of those are already here.`);
      } else {
        // Chunked so a calendar with thousands of events doesn't go up as one
        // enormous request. Upsert rather than insert so a re-import is safe
        // even when the local dedupe hasn't loaded — the unique index on
        // (user_id, uid) decides, not the browser.
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase
            .from("jokes")
            .upsert(rows.slice(i, i + 500), {
              onConflict: "user_id,uid",
              ignoreDuplicates: true,
            });
          if (error) throw error;
        }
        await load();
        setFilter("unrated");
        setNote(
          `Imported ${rows.length} ${rows.length === 1 ? "joke" : "jokes"} — rate them below.`
        );
      }
    } catch {
      setNote("Couldn't read that file. It should be a .ics from Google Calendar's export.");
    }
    setImporting(false);
  }

  return (
    <div className="space-y-8">
      {/* Review queue — the whole point of importing them untagged */}
      <section className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)]">
        <div className="flex items-baseline justify-between mb-4">
          <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase">
            Review
          </p>
          <span className="text-xs text-[var(--text-muted)]">
            {unrated.length} to go · {sfwCount} SFW · {nsfwCount} NSFW
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading your jokes…</p>
        ) : current ? (
          <div className="space-y-5">
            <div className="rounded-xl bg-[var(--bg)] border border-[var(--border)] p-5">
              <p className="text-[15px] text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                {current.text}
              </p>
              {current.punchline && (
                <p className="mt-3 text-sm text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap">
                  {current.punchline}
                </p>
              )}
              {current.event_date && (
                <p className="mt-4 text-[11px] text-[var(--text-muted)]">
                  From {current.event_date}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => rate(current.id, "sfw")}
                className="flex-1 py-2.5 rounded-full bg-[var(--pastel-sage)] text-[var(--text)] text-sm font-medium hover:opacity-80 transition-opacity"
              >
                SFW
              </button>
              <button
                onClick={() => rate(current.id, "nsfw")}
                className="flex-1 py-2.5 rounded-full bg-[var(--pastel-rose)] text-[var(--text)] text-sm font-medium hover:opacity-80 transition-opacity"
              >
                NSFW
              </button>
              <button
                onClick={() => remove(current.id)}
                className="px-5 py-2.5 rounded-full text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            {jokes.length
              ? "Every joke is rated. Import more below, or browse what you have."
              : "No jokes yet — import your calendar below and they'll queue up here."}
          </p>
        )}
      </section>

      {/* The collection */}
      {jokes.length > 0 && (
        <section className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)]">
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase">
              My Jokes
            </p>
            <span className="text-xs text-[var(--text-muted)]">
              {jokes.length} {jokes.length === 1 ? "joke" : "jokes"}
            </span>
          </div>

          <div className="flex gap-1 mb-5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs transition-colors ${
                  filter === f.key
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nothing in that pile.</p>
          ) : (
            <div className="space-y-2">
              {visible.map((j) => (
                <div
                  key={j.id}
                  className="rounded-xl bg-[var(--bg)] border border-[var(--border)] p-4"
                >
                  <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                    {j.text}
                  </p>
                  {j.punchline && (
                    <p className="mt-2 text-[13px] text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap">
                      {j.punchline}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => rate(j.id, "sfw")}
                      className={`px-2.5 py-1 rounded-full text-[10px] tracking-wider uppercase transition-colors ${
                        j.rating === "sfw"
                          ? "bg-[var(--pastel-sage)] text-[var(--text)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      SFW
                    </button>
                    <button
                      onClick={() => rate(j.id, "nsfw")}
                      className={`px-2.5 py-1 rounded-full text-[10px] tracking-wider uppercase transition-colors ${
                        j.rating === "nsfw"
                          ? "bg-[var(--pastel-rose)] text-[var(--text)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      NSFW
                    </button>
                    <button
                      onClick={() => remove(j.id)}
                      className="ml-auto text-[10px] tracking-wider uppercase text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Import */}
      <section className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)]">
        <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase mb-3">
          Import from Calendar
        </p>
        <p className="text-[13px] text-[var(--text-muted)] leading-relaxed mb-4">
          In Google Calendar: Settings → Import &amp; export → Export. Unzip what it
          downloads and pick the <code className="text-[var(--text)]">.ics</code> for
          your joke calendar. Importing the same file twice is safe — anything
          already here is skipped.
        </p>
        <label className="inline-block">
          <input
            type="file"
            accept=".ics,text/calendar"
            className="sr-only"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importFile(file);
              e.target.value = "";
            }}
          />
          <span
            className={`inline-block px-6 py-2.5 rounded-full bg-[var(--accent)] text-white text-sm font-medium transition-colors ${
              importing ? "opacity-50" : "hover:bg-[var(--accent-hover)] cursor-pointer"
            }`}
          >
            {importing ? "Importing…" : "Choose .ics file"}
          </span>
        </label>
        {note && <p className="mt-4 text-[13px] text-[var(--text)]">{note}</p>}
      </section>
    </div>
  );
}
