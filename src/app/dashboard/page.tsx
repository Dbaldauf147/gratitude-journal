"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import MeditationsTab from "./MeditationsTab";

type Tab = "journal" | "meditations";

interface GratitudeEntry {
  id: string;
  grateful_1: string;
  grateful_2: string;
  grateful_3: string;
  created_at: string;
}

interface Affirmation {
  id: string;
  text: string;
  approved: boolean;
  dismissed: boolean;
  shown_at: string;
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

const DEFAULT_AFFIRMATIONS = [
  "I am worthy of love, happiness, and fulfillment.",
  "I choose to focus on what I can control and let go of the rest.",
  "I am growing stronger and more resilient every day.",
  "I am grateful for the abundance that flows into my life.",
  "I trust the timing of my journey.",
  "I am enough, just as I am.",
  "I attract positivity and release negativity.",
  "My challenges are opportunities for growth.",
  "I am surrounded by love and support.",
  "I choose peace over worry.",
  "I am capable of achieving anything I set my mind to.",
  "I honor my body and treat it with kindness.",
  "Every day is a fresh start full of possibilities.",
  "I radiate confidence, warmth, and compassion.",
  "I am deserving of rest and self-care.",
  "I celebrate my progress, no matter how small.",
  "I release comparison and embrace my unique path.",
  "I am a positive force in the lives of those around me.",
  "My potential is limitless.",
  "I welcome joy into every moment of today.",
];

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const [todayEntry, setTodayEntry] = useState<GratitudeEntry | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit1, setEdit1] = useState("");
  const [edit2, setEdit2] = useState("");
  const [edit3, setEdit3] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [pastDate, setPastDate] = useState("");
  const [past1, setPast1] = useState("");
  const [past2, setPast2] = useState("");
  const [past3, setPast3] = useState("");
  const [pastSaving, setPastSaving] = useState(false);
  const [showPastEntry, setShowPastEntry] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [tab, setTab] = useState<Tab>("journal");

  // Affirmation state
  const [todayAffirmation, setTodayAffirmation] = useState<string>("");
  const [affirmationStatus, setAffirmationStatus] = useState<"pending" | "approved" | "dismissed">("pending");
  const [approvedAffirmations, setApprovedAffirmations] = useState<Affirmation[]>([]);

  const loadEntries = useCallback(async () => {
    const { data } = await supabase
      .from("gratitude_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (data) {
      setEntries(data);
      const todayE = data.find((e) => isToday(e.created_at));
      setTodayEntry(todayE || null);
    }
  }, [supabase]);

  const loadAffirmations = useCallback(async () => {
    // Load all user's affirmations
    const { data } = await supabase
      .from("affirmations")
      .select("*")
      .order("shown_at", { ascending: false });

    const all = data || [];
    setApprovedAffirmations(all.filter((a) => a.approved && !a.dismissed));

    // Check if there's already one for today
    const todayAff = all.find((a) => isToday(a.shown_at));

    if (todayAff) {
      setTodayAffirmation(todayAff.text);
      setAffirmationStatus(todayAff.approved ? "approved" : todayAff.dismissed ? "dismissed" : "pending");
    } else {
      // Pick a new affirmation: prefer approved ones in rotation, otherwise use defaults
      const approved = all.filter((a) => a.approved && !a.dismissed);
      const dismissed = new Set(all.filter((a) => a.dismissed).map((a) => a.text));
      const available = approved.length > 0
        ? approved.map((a) => a.text)
        : DEFAULT_AFFIRMATIONS.filter((a) => !dismissed.has(a));

      if (available.length > 0) {
        // Pick based on day of year for consistency
        const dayOfYear = Math.floor(
          (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
        );
        const pick = available[dayOfYear % available.length];
        setTodayAffirmation(pick);
        setAffirmationStatus("pending");
      }
    }
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
      }
    });
  }, [supabase, router]);

  useEffect(() => {
    if (user) {
      loadEntries();
      loadAffirmations();
    }
  }, [user, loadEntries, loadAffirmations]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!grateful1.trim() || !grateful2.trim() || !grateful3.trim()) return;

    setSaving(true);
    const { error } = await supabase.from("gratitude_entries").insert({
      user_id: user?.id,
      grateful_1: grateful1.trim(),
      grateful_2: grateful2.trim(),
      grateful_3: grateful3.trim(),
    }).select();

    if (!error) {
      setGrateful1("");
      setGrateful2("");
      setGrateful3("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await loadEntries();
    } else {
      alert("Error saving: " + error.message);
    }
    setSaving(false);
  }

  async function handlePastSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!past1.trim() || !past2.trim() || !past3.trim() || !pastDate) return;

    // Check if entry already exists for this date (compare in local time)
    const existing = entries.find((en) => {
      const d = new Date(en.created_at);
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return localDate === pastDate;
    });
    if (existing) {
      alert("An entry already exists for this date. Edit it below instead.");
      return;
    }

    setPastSaving(true);
    const { error } = await supabase.from("gratitude_entries").insert({
      user_id: user?.id,
      grateful_1: past1.trim(),
      grateful_2: past2.trim(),
      grateful_3: past3.trim(),
      created_at: `${pastDate}T21:00:00.000Z`,
    }).select();

    if (!error) {
      setPast1("");
      setPast2("");
      setPast3("");
      setPastDate("");
      setShowPastEntry(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await loadEntries();
    } else {
      alert("Error saving: " + error.message);
    }
    setPastSaving(false);
  }

  // Dates that already have entries
  const entryDates = new Set(entries.map((e) => {
    const d = new Date(e.created_at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }));

  function startEditing(entry: GratitudeEntry) {
    setEditingId(entry.id);
    setEdit1(entry.grateful_1);
    setEdit2(entry.grateful_2);
    setEdit3(entry.grateful_3);
  }

  function cancelEditing() {
    setEditingId(null);
  }

  async function saveEdit(entryId: string) {
    if (!edit1.trim() || !edit2.trim() || !edit3.trim()) return;
    setEditSaving(true);
    const { error } = await supabase
      .from("gratitude_entries")
      .update({
        grateful_1: edit1.trim(),
        grateful_2: edit2.trim(),
        grateful_3: edit3.trim(),
      })
      .eq("id", entryId);

    if (!error) {
      setEditingId(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await loadEntries();
    }
    setEditSaving(false);
  }

  async function handleAffirmation(approve: boolean) {
    if (!user || !todayAffirmation) return;

    // Check if this affirmation already exists for today (use local date)
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const localTomorrow = (() => { const t = new Date(now); t.setDate(t.getDate() + 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })();
    const { data: existing } = await supabase
      .from("affirmations")
      .select("id")
      .eq("text", todayAffirmation)
      .gte("shown_at", localToday)
      .lt("shown_at", localTomorrow);

    if (existing && existing.length > 0) {
      await supabase
        .from("affirmations")
        .update({ approved: approve, dismissed: !approve })
        .eq("id", existing[0].id);
    } else {
      await supabase.from("affirmations").insert({
        user_id: user.id,
        text: todayAffirmation,
        approved: approve,
        dismissed: !approve,
      });
    }

    setAffirmationStatus(approve ? "approved" : "dismissed");
    // Update approved list locally without reloading (avoids timezone-based reset)
    if (approve) {
      setApprovedAffirmations(prev => {
        if (prev.some(a => a.text === todayAffirmation)) return prev;
        return [...prev, { id: 'temp', text: todayAffirmation, approved: true, dismissed: false, shown_at: new Date().toISOString() }];
      });
    } else {
      setApprovedAffirmations(prev => prev.filter(a => a.text !== todayAffirmation));
    }
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
      else if (i > 0) break;
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

      {/* Tab navigation */}
      <nav className="max-w-2xl mx-auto px-6 mb-8">
        <div className="flex gap-1 p-1 bg-[var(--surface)] rounded-full border border-[var(--border)] w-fit mx-auto">
          {([
            { key: "journal", label: "Journal" },
            { key: "meditations", label: "Meditations" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-full text-sm transition-colors ${
                tab === t.key
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 space-y-10">

        {tab === "meditations" && <MeditationsTab />}

        {tab === "journal" && <>

        {/* Daily Affirmation */}
        {todayAffirmation && (
          <section className="bg-[var(--pastel-lavender)] rounded-2xl p-8 text-center">
            <p className="text-xs text-[var(--text-muted)] tracking-widest uppercase mb-4">
              Today&apos;s Affirmation
            </p>
            <p className="text-lg font-light text-[var(--text)] leading-relaxed italic mb-6">
              &ldquo;{todayAffirmation}&rdquo;
            </p>
            {affirmationStatus === "pending" ? (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => handleAffirmation(true)}
                  className="px-6 py-2.5 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Keep in Rotation
                </button>
                <button
                  onClick={() => handleAffirmation(false)}
                  className="px-6 py-2.5 rounded-full border border-[var(--border)] bg-white text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium ${
                  affirmationStatus === "approved"
                    ? "bg-[var(--pastel-sage)] text-[var(--text)]"
                    : "bg-[var(--bg)] text-[var(--text-muted)]"
                }`}>
                  {affirmationStatus === "approved" ? "✓ Saved to your rotation" : "✗ Removed from circulation"}
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">A new affirmation will appear tomorrow</p>
              </div>
            )}
          </section>
        )}

        {/* Today's Entry Form */}
        {!todayEntry ? (
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
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Come back tomorrow evening to continue your practice.
            </p>
            <button
              onClick={() => startEditing(todayEntry)}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Edit today&apos;s entry
            </button>
          </section>
        )}

        {/* Past Entry */}
        <div className="text-center">
          <button
            onClick={() => setShowPastEntry((p) => !p)}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            {showPastEntry ? "Hide" : "Add a past entry"}
          </button>
        </div>

        {showPastEntry && (
          <section id="past-entry-form" className="bg-[var(--surface)] rounded-2xl p-8 shadow-sm border border-[var(--border)]">
            <h2 className="text-lg font-light text-[var(--text)] mb-1">
              Past Reflection
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Fill in a journal entry for a previous day.
            </p>
            <form onSubmit={handlePastSubmit} className="space-y-4">
              <div>
                <span className="text-xs text-[var(--text-muted)] block mb-1">Date</span>
                <input
                  type="date"
                  value={pastDate}
                  onChange={(e) => setPastDate(e.target.value)}
                  max={new Date(Date.now() - 86400000).toISOString().split("T")[0]}
                  min={new Date(Date.now() - 100 * 86400000).toISOString().split("T")[0]}
                  required
                  className="px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--accent)] transition-colors w-full"
                />
                {pastDate && entryDates.has(pastDate) && (
                  <p className="text-xs text-red-400 mt-1">An entry already exists for this date.</p>
                )}
              </div>

              {[
                { value: past1, setter: setPast1, idx: 0 },
                { value: past2, setter: setPast2, idx: 1 },
                { value: past3, setter: setPast3, idx: 2 },
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

              <button
                type="submit"
                disabled={pastSaving || !pastDate || entryDates.has(pastDate)}
                className="w-full py-3 rounded-full bg-[var(--accent)] text-white text-sm font-medium tracking-wide hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
              >
                {pastSaving ? "Saving..." : "Save Past Entry"}
              </button>
            </form>
          </section>
        )}

        {saved && (
          <div className="fixed bottom-6 right-6 bg-[var(--pastel-sage)] text-[var(--text)] text-sm px-5 py-2.5 rounded-full shadow-md">
            Saved
          </div>
        )}

        {/* Approved Affirmations */}
        {approvedAffirmations.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-xs text-[var(--text-muted)] tracking-widest uppercase">
              Your Affirmations
            </h3>
            <div className="bg-[var(--surface)] rounded-2xl p-6 shadow-sm border border-[var(--border)]">
              <div className="space-y-3">
                {approvedAffirmations.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 group">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[var(--pastel-lavender)]" />
                    <p className="flex-1 text-sm text-[var(--text)] leading-relaxed italic">
                      {a.text}
                    </p>
                    <button
                      onClick={async () => {
                        await supabase
                          .from("affirmations")
                          .update({ dismissed: true, approved: false })
                          .eq("id", a.id);
                        await loadAffirmations();
                      }}
                      className="text-xs text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all shrink-0"
                      title="Remove from rotation"
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
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
                id={`entry-${entry.id}`}
                className="bg-[var(--surface)] rounded-2xl p-6 shadow-sm border border-[var(--border)]"
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatDate(entry.created_at)}
                  </p>
                  {editingId !== entry.id && (
                    <button
                      onClick={() => startEditing(entry)}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingId === entry.id ? (
                  <div className="space-y-3">
                    {[
                      { value: edit1, setter: setEdit1, idx: 0 },
                      { value: edit2, setter: setEdit2, idx: 1 },
                      { value: edit3, setter: setEdit3, idx: 2 },
                    ].map(({ value, setter, idx }) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div
                          className="w-2 h-2 rounded-full mt-3.5 shrink-0"
                          style={{ backgroundColor: PASTEL_COLORS[idx] }}
                        />
                        <textarea
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          rows={2}
                          className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--accent)] transition-colors resize-none leading-relaxed"
                        />
                      </div>
                    ))}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => saveEdit(entry.id)}
                        disabled={editSaving}
                        className="flex-1 py-2.5 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                      >
                        {editSaving ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-6 py-2.5 rounded-full border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
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
                )}
              </div>
            ))}
          </section>
        )}

        </>}
      </div>

      {/* Calendar — fixed right sidebar (Journal tab only) */}
      {tab === "journal" && <div className="fixed top-24 right-6 w-52 hidden lg:block">
        <div className="bg-[var(--surface)] rounded-xl p-3 shadow-sm border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setCalendarMonth(prev => {
                const d = new Date(prev.year, prev.month - 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors text-xs"
            >
              ‹
            </button>
            <h3 className="text-[11px] font-medium text-[var(--text)]">
              {new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </h3>
            <button
              onClick={() => {
                const now = new Date();
                if (calendarMonth.year < now.getFullYear() || (calendarMonth.year === now.getFullYear() && calendarMonth.month < now.getMonth())) {
                  setCalendarMonth(prev => {
                    const d = new Date(prev.year, prev.month + 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  });
                }
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors text-xs"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-px text-center">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-[8px] text-[var(--text-muted)] font-medium py-0.5">{d}</div>
            ))}
            {(() => {
              const firstDay = new Date(calendarMonth.year, calendarMonth.month, 1).getDay();
              const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
              const today = new Date();
              const todayStr2 = toLocalDateStr(today);
              const entryDateSet = new Set(entries.map(e => toLocalDateStr(new Date(e.created_at))));
              const cells = [];
              for (let i = 0; i < firstDay; i++) cells.push(<div key={`blank-${i}`} />);
              for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasEntry = entryDateSet.has(dateStr);
                const isDayToday = dateStr === todayStr2;
                const isFuture = new Date(dateStr) > today;
                const entry = hasEntry ? entries.find(e => toLocalDateStr(new Date(e.created_at)) === dateStr) : null;
                cells.push(
                  <button
                    key={day}
                    disabled={isFuture}
                    onClick={() => {
                      if (entry) {
                        startEditing(entry);
                        const el = document.getElementById(`entry-${entry.id}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      } else if (!isFuture) {
                        setPastDate(dateStr);
                        setShowPastEntry(true);
                        setPast1(''); setPast2(''); setPast3('');
                        setTimeout(() => {
                          const el = document.getElementById('past-entry-form');
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }
                    }}
                    className={`relative w-full aspect-square rounded flex items-center justify-center transition-all ${
                      isFuture ? 'text-[var(--text-muted)] opacity-25 cursor-default text-[9px]' :
                      isDayToday ? 'font-bold ring-1.5 ring-[var(--accent)] text-[var(--accent)] text-[10px]' :
                      hasEntry ? 'cursor-pointer hover:opacity-80 text-[10px]' :
                      'cursor-pointer hover:bg-[var(--bg)] text-[var(--text-muted)] text-[9px]'
                    }`}
                    style={hasEntry ? { backgroundColor: 'var(--pastel-sage)' } : undefined}
                  >
                    {day}
                  </button>
                );
              }
              return cells;
            })()}
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border)]">
            <span className="flex items-center gap-1 text-[8px] text-[var(--text-muted)]">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'var(--pastel-sage)' }} /> Logged
            </span>
            <span className="flex items-center gap-1 text-[8px] text-[var(--text-muted)]">
              <span className="w-2 h-2 rounded-sm ring-1 ring-[var(--accent)]" /> Today
            </span>
          </div>
        </div>
      </div>}
    </main>
  );
}
