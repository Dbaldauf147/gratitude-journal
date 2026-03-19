"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface GratitudeEntry {
  id: string;
  grateful_1: string;
  grateful_2: string;
  grateful_3: string;
  created_at: string;
}

const PASTEL_COLORS = [
  "var(--pastel-rose)",
  "var(--pastel-lavender)",
  "var(--pastel-sage)",
];

const PLACEHOLDERS = [
  "Something that made you smile today...",
  "A person you appreciate...",
  "A simple pleasure you enjoyed...",
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: { full_name?: string } } | null>(null);
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [grateful1, setGrateful1] = useState("");
  const [grateful2, setGrateful2] = useState("");
  const [grateful3, setGrateful3] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [todayDone, setTodayDone] = useState(false);

  const loadEntries = useCallback(async () => {
    const { data } = await supabase
      .from("gratitude_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (data) {
      setEntries(data);
      const hasTodayEntry = data.some((e) => isToday(e.created_at));
      setTodayDone(hasTodayEntry);
    }
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
        loadEntries();
      }
    });
  }, [supabase, router, loadEntries]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!grateful1.trim() || !grateful2.trim() || !grateful3.trim()) return;

    setSaving(true);
    const { error } = await supabase.from("gratitude_entries").insert({
      user_id: user?.id,
      grateful_1: grateful1.trim(),
      grateful_2: grateful2.trim(),
      grateful_3: grateful3.trim(),
    });

    if (!error) {
      setGrateful1("");
      setGrateful2("");
      setGrateful3("");
      setSaved(true);
      setTodayDone(true);
      setTimeout(() => setSaved(false), 3000);
      loadEntries();
    }
    setSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  const name = user?.user_metadata?.full_name?.split(" ")[0] || "";
  const streak = (() => {
    let count = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split("T")[0];
      const hasEntry = entries.some(
        (e) => e.created_at.split("T")[0] === dateStr
      );
      if (hasEntry) count++;
      else if (i > 0) break; // today can be empty without breaking
    }
    return count;
  })();

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 max-w-2xl mx-auto">
        <div>
          <p className="text-sm text-[var(--text-muted)]">
            {greeting}{name ? `, ${name}` : ""}
          </p>
          <h1 className="text-xl font-light text-[var(--text)]">
            Your Journal
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {streak > 0 && (
            <span className="text-xs text-[var(--accent)] bg-[var(--pastel-rose)] px-3 py-1 rounded-full">
              {streak} day streak
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 space-y-10">
        {/* Today's Entry Form */}
        {!todayDone ? (
          <section className="bg-[var(--surface)] rounded-2xl p-8 shadow-sm border border-[var(--border)]">
            <h2 className="text-lg font-light text-[var(--text)] mb-1">
              Tonight&apos;s Reflection
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-6">
              What are three things you&apos;re grateful for today?
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { value: grateful1, setter: setGrateful1, idx: 0 },
                { value: grateful2, setter: setGrateful2, idx: 1 },
                { value: grateful3, setter: setGrateful3, idx: 2 },
              ].map(({ value, setter, idx }) => (
                <div key={idx} className="flex items-start gap-3">
                  <div
                    className="w-2 h-2 rounded-full mt-3.5 shrink-0"
                    style={{ backgroundColor: PASTEL_COLORS[idx] }}
                  />
                  <textarea
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={PLACEHOLDERS[idx]}
                    required
                    rows={2}
                    className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--accent)] transition-colors resize-none leading-relaxed"
                  />
                </div>
              ))}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 rounded-full bg-[var(--accent)] text-white text-sm font-medium tracking-wide hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Today's Gratitude"}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="bg-[var(--surface)] rounded-2xl p-8 shadow-sm border border-[var(--border)] text-center">
            <div className="text-3xl mb-3">&#10024;</div>
            <h2 className="text-lg font-light text-[var(--text)] mb-1">
              Today&apos;s reflection is complete
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Come back tomorrow evening to continue your practice.
            </p>
          </section>
        )}

        {saved && (
          <div className="fixed bottom-6 right-6 bg-[var(--pastel-sage)] text-[var(--text)] text-sm px-5 py-2.5 rounded-full shadow-md animate-fade-in">
            Saved
          </div>
        )}

        {/* Past Entries */}
        {entries.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-xs text-[var(--text-muted)] tracking-widest uppercase">
              Past Reflections
            </h3>
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-[var(--surface)] rounded-2xl p-6 shadow-sm border border-[var(--border)]"
              >
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  {formatDate(entry.created_at)}
                </p>
                <div className="space-y-3">
                  {[entry.grateful_1, entry.grateful_2, entry.grateful_3].map(
                    (text, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: PASTEL_COLORS[i] }}
                        />
                        <p className="text-sm text-[var(--text)] leading-relaxed">
                          {text}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
