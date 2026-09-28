"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { pickDadJoke } from "@/lib/dadJokes";

interface Ruling {
  text: string;
  saved: boolean;
  created_at: string;
}

const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * A dad joke for days with no joke. Save keeps it (listed under the card);
 * Throw away retires it for good and hands over the next one.
 */
export default function DadJokeCard({ userId, todayKey }: { userId: string; todayKey: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rulings, setRulings] = useState<Ruling[] | null>(null);
  const [error, setError] = useState("");
  const [showSaved, setShowSaved] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("dad_jokes")
      .select("text, saved, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
      setRulings([]);
      return;
    }
    setRulings(data || []);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const saved = useMemo(() => (rulings || []).filter((r) => r.saved), [rulings]);

  // A joke saved today stays on the card for the rest of the day, marked as
  // saved. Otherwise it's the day's pick from whatever hasn't been ruled on —
  // which is how throwing one away moves straight on to the next.
  const savedToday = saved.find((r) => localDay(r.created_at) === todayKey);
  const joke = useMemo(() => {
    if (!rulings) return null;
    if (savedToday) return savedToday.text;
    return pickDadJoke(
      todayKey,
      userId,
      new Set(rulings.map((r) => r.text)),
      saved.map((r) => r.text)
    );
  }, [rulings, savedToday, saved, todayKey, userId]);

  async function rule(keep: boolean) {
    if (!joke) return;
    setError("");
    const row = { text: joke, saved: keep, created_at: new Date().toISOString() };
    const before = rulings;
    // Optimistic: the next joke (or the "saved" state) shows at once.
    setRulings((prev) => [row, ...(prev || []).filter((r) => r.text !== joke)]);
    const { error } = await supabase
      .from("dad_jokes")
      .upsert({ user_id: userId, ...row }, { onConflict: "user_id,text" });
    if (error) {
      setRulings(before);
      setError(error.message);
    }
  }

  async function unsave(text: string) {
    const before = rulings;
    setRulings((prev) => (prev || []).map((r) => (r.text === text ? { ...r, saved: false } : r)));
    const { error } = await supabase.from("dad_jokes").update({ saved: false }).eq("text", text);
    if (error) {
      setRulings(before);
      setError(error.message);
    }
  }

  if (!rulings || (!joke && !saved.length)) return null;

  return (
    <section className="bg-[var(--pastel-sky)] rounded-2xl p-5 text-center">
      <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase mb-2">
        Today&apos;s Dad Joke
      </p>
      {joke && (
        <p className="text-sm font-light text-[var(--text)] leading-relaxed mb-3">{joke}</p>
      )}
      {joke && !savedToday && (
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => rule(true)}
            className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => rule(false)}
            className="px-4 py-1.5 rounded-full border border-[var(--border)] bg-white text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Throw away
          </button>
        </div>
      )}
      {savedToday && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--pastel-sage)] text-[var(--text)]">
          ✓ Saved
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {saved.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowSaved((s) => !s)}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] underline underline-offset-2"
          >
            {showSaved ? "Hide" : "Show"} saved dad jokes ({saved.length})
          </button>
          {showSaved && (
            <ul className="mt-2 text-left space-y-1.5">
              {saved.map((r) => (
                <li key={r.text} className="flex items-start gap-2 text-xs text-[var(--text)] bg-white/60 rounded-lg px-3 py-2">
                  <span className="flex-1">{r.text}</span>
                  <button
                    onClick={() => unsave(r.text)}
                    aria-label="Remove from saved"
                    title="Remove from saved"
                    className="text-[var(--text-muted)] hover:text-[var(--text)] text-base leading-none"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
