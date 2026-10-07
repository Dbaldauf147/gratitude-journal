"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import InstallHint from "../InstallHint";
import MeditationsTab from "./MeditationsTab";
import JokesTab from "./JokesTab";
import SettingsSheet from "./SettingsSheet";
import TodayMediaCard from "./TodayMediaCard";
import DadJokeCard from "./DadJokeCard";
import MediaGrid from "./MediaGrid";
import { listDayMedia, dayAgo, type DayMedia } from "@/lib/dailyMedia";
import { getWordOfTheDay, type KoreanWord } from "@/lib/koreanWords";
import { ownsJokes, seesDailyJoke, skipsQuoteCalendar } from "@/lib/roles";
import { pickPopularQuote } from "@/lib/popularQuotes";
import { pickAffirmation } from "@/lib/affirmations";

type Tab = "journal" | "korean" | "meditations" | "jokes";

// Journal history kept on the device so an installed app opens with content on
// the very first frame instead of an empty shell. Keyed per user — this is a
// shared-device app and one account must never flash another's entries.
const entriesCacheKey = (userId: string) => `gratitude:entries:v1:${userId}`;

// Tab bar glyphs. Inline rather than an icon package: four icons doesn't earn a
// dependency, and these need to match the hairline weight of the rest of the UI.
function TabIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: active ? 2 : 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (tab) {
    case "journal":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 3v18M12 8.5h4M12 12.5h4" />
        </svg>
      );
    case "korean":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "meditations":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="2.5" />
          <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
          <path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
        </svg>
      );
    case "jokes":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
          <path d="M9 9.5h.01M15 9.5h.01" />
        </svg>
      );
  }
}

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

interface SavedQuote {
  id: string;
  text: string;
  author: string | null;
  approved: boolean;
  dismissed: boolean;
  shown_at: string;
}

interface PhraseWord {
  hangul: string;
  romanization: string;
  meaning: string;
  sound: string;
}

interface PhraseRegister {
  hangul: string;
  romanization: string;
  note: string;
}

interface PhraseResult {
  hangul: string;
  romanization: string;
  formal?: PhraseRegister;
  informal?: PhraseRegister;
  slang?: PhraseRegister;
  words: PhraseWord[];
  wholeTip: string;
  example: { korean: string; english: string };
}

interface SavedPhrase {
  id: string;
  korean: string;
  translation: string;
  added: number;
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
  const [throwbacks, setThrowbacks] = useState<{ monthAgo: GratitudeEntry | null; yearAgo: GratitudeEntry | null }>({ monthAgo: null, yearAgo: null });
  const [koreanWord] = useState(() => getWordOfTheDay());
  const [meaningRevealed, setMeaningRevealed] = useState(false);
  const [learnedWords, setLearnedWords] = useState<KoreanWord[]>([]);

  // Manually saved Korean phrases (Korean tab). Translation is hidden until held.
  const [savedPhrases, setSavedPhrases] = useState<SavedPhrase[]>([]);
  const [phraseKorean, setPhraseKorean] = useState("");
  const [phraseTranslation, setPhraseTranslation] = useState("");
  const [revealedPhraseId, setRevealedPhraseId] = useState<string | null>(null);

  // Type-a-phrase tool (Claude-powered translation + per-word pronunciation).
  const [phraseInput, setPhraseInput] = useState("");
  const [phraseResult, setPhraseResult] = useState<PhraseResult | null>(null);
  const [phraseLoading, setPhraseLoading] = useState(false);
  const [phraseError, setPhraseError] = useState("");

  // The local day, kept live. This used to be computed once per render, which
  // in practice meant once when the dashboard mounted — and an installed PWA or
  // a phone tab is never remounted. The daily cards then sat on whatever was
  // picked the evening the app was first opened, for as long as the app stayed
  // resident: the same affirmation, quote, joke and Korean word every day.
  const [todayKey, setTodayKey] = useState(() => toLocalDateStr(new Date()));

  useEffect(() => {
    const check = () =>
      setTodayKey((prev) => {
        const now = toLocalDateStr(new Date());
        return now === prev ? prev : now;
      });
    // Both halves matter: the timer catches midnight while the app is open, and
    // the events catch a phone that was asleep across it.
    const timer = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  async function submitPhrase(e: React.FormEvent) {
    e.preventDefault();
    const phrase = phraseInput.trim();
    if (!phrase || phraseLoading) return;
    setPhraseLoading(true);
    setPhraseError("");
    setPhraseResult(null);
    try {
      const res = await fetch("/api/korean-phrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhraseError(data?.error || "Something went wrong. Try again.");
      } else {
        setPhraseResult(data as PhraseResult);
        // Persist so the translation survives a page refresh.
        try {
          localStorage.setItem(
            "koreanPhraseTool",
            JSON.stringify({ input: phrase, result: data })
          );
        } catch {
          /* ignore */
        }
      }
    } catch {
      setPhraseError("Couldn't reach the translator. Check your connection and try again.");
    }
    setPhraseLoading(false);
  }

  // Load learned words + restore today's reveal state from localStorage.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("learnedKoreanWords");
      if (saved) setLearnedWords(JSON.parse(saved));
      const savedP = localStorage.getItem("savedKoreanPhrases");
      if (savedP) setSavedPhrases(JSON.parse(savedP));
      // Meaning stays revealed for the rest of the day, then auto-hides for the next word.
      if (localStorage.getItem("koreanRevealDate") === todayKey) setMeaningRevealed(true);
      // Restore the last translated phrase so it survives a refresh.
      const savedPhrase = localStorage.getItem("koreanPhraseTool");
      if (savedPhrase) {
        const { input, result } = JSON.parse(savedPhrase);
        if (typeof input === "string") setPhraseInput(input);
        if (result) setPhraseResult(result as PhraseResult);
      }
    } catch {
      /* ignore corrupt/unavailable storage */
    }
  }, [todayKey]);

  function revealMeaning() {
    setMeaningRevealed(true);
    try {
      localStorage.setItem("koreanRevealDate", todayKey);
    } catch {
      /* ignore */
    }
  }

  const isLearned = learnedWords.some((w) => w.hangul === koreanWord.hangul);

  function toggleLearned() {
    setLearnedWords((prev) => {
      const next = prev.some((w) => w.hangul === koreanWord.hangul)
        ? prev.filter((w) => w.hangul !== koreanWord.hangul)
        : [...prev, koreanWord];
      try {
        localStorage.setItem("learnedKoreanWords", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function removeLearned(hangul: string) {
    setLearnedWords((prev) => {
      const next = prev.filter((w) => w.hangul !== hangul);
      try {
        localStorage.setItem("learnedKoreanWords", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function persistPhrases(next: SavedPhrase[]) {
    setSavedPhrases(next);
    try {
      localStorage.setItem("savedKoreanPhrases", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function addPhrase(e: React.FormEvent) {
    e.preventDefault();
    const korean = phraseKorean.trim();
    if (!korean) return;
    const entry: SavedPhrase = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${savedPhrases.length}`,
      korean,
      translation: phraseTranslation.trim(),
      added: Date.now(),
    };
    persistPhrases([entry, ...savedPhrases]);
    setPhraseKorean("");
    setPhraseTranslation("");
  }

  function removePhrase(id: string) {
    persistPhrases(savedPhrases.filter((p) => p.id !== id));
  }

  function speakKorean(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.85;
    const koVoice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang === "ko-KR" || v.lang.startsWith("ko"));
    if (koVoice) utterance.voice = koVoice;
    window.speechSynthesis.speak(utterance);
  }
  const [quote, setQuote] = useState<{ quote: string; author: string } | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<"pending" | "approved" | "dismissed">("pending");
  const [approvedQuotes, setApprovedQuotes] = useState<SavedQuote[]>([]);
  // Every quote text this user has already ruled on, kept or removed. Drives
  // the popular-quote fallback so it never re-offers one they've seen.
  const [seenQuotes, setSeenQuotes] = useState<Set<string>>(new Set());
  // Set while a Keep/Remove is saving. Each press used to await two round
  // trips before the card changed, so a slow connection invited repeat taps —
  // one account logged the same removal five times in a row.
  // The ref is the real guard — state only lands on the next render, which is
  // too late for taps in quick succession. The state drives `disabled`.
  const [quoteBusy, setQuoteBusy] = useState(false);
  const quoteBusyRef = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit1, setEdit1] = useState("");
  const [edit2, setEdit2] = useState("");
  const [edit3, setEdit3] = useState("");
  const [editDate, setEditDate] = useState("");
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
  const [showSettings, setShowSettings] = useState(false);

  // One SFW joke a day, for the accounts that get one. Fetched from the server
  // because the jokes belong to another account and RLS won't hand them over.
  const [dailyJoke, setDailyJoke] = useState<{ text: string; punchline: string | null } | null>(null);
  // Whether the curated joke has been looked up for today. The dad-joke card
  // waits on it, so an account that does get a joke never sees one flash first.
  const [jokeCheckedFor, setJokeCheckedFor] = useState("");

  // Photos and videos saved a month and a year ago, for "On This Day".
  const [throwbackMedia, setThrowbackMedia] = useState<{ monthAgo: DayMedia[]; yearAgo: DayMedia[] }>({ monthAgo: [], yearAgo: [] });

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

      // "On this day" throwback. The 100-entry window above may not reach back
      // far enough, so check the loaded set first and fall back to a query.
      const findForDate = async (date: Date): Promise<GratitudeEntry | null> => {
        const str = toLocalDateStr(date);
        const inData = data.find((e) => toLocalDateStr(new Date(e.created_at)) === str);
        if (inData) return inData;
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        const { data: d } = await supabase
          .from("gratitude_entries")
          .select("*")
          .gte("created_at", dayStart.toISOString())
          .lte("created_at", dayEnd.toISOString())
          .limit(1);
        return d?.[0] || null;
      };

      // Show a month ago today and a year ago today side by side.
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);

      const [monthAgoEntry, yearAgoEntry] = await Promise.all([
        findForDate(monthAgo),
        findForDate(yearAgo),
      ]);
      setThrowbacks({ monthAgo: monthAgoEntry, yearAgo: yearAgoEntry });
    }
    // todayKey isn't read here, but isToday() and the throwback offsets all
    // resolve against the local day, so this has to re-run when it rolls over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, todayKey]);

  const loadAffirmations = useCallback(async () => {
    // Load all user's affirmations
    const { data } = await supabase
      .from("affirmations")
      .select("*")
      .order("shown_at", { ascending: false });

    const all: Affirmation[] = data || [];

    // Rows are one-per-day, so the same text piles up with conflicting
    // verdicts. Only the newest row for a text counts — otherwise a months-old
    // approval outvotes today's dismissal and the line can never be retired.
    // `all` is already newest-first, so the first row for a text wins.
    const latestByText = new Map<string, Affirmation>();
    for (const a of all) {
      if (!latestByText.has(a.text)) latestByText.set(a.text, a);
    }
    const standing = Array.from(latestByText.values());
    const approved = standing.filter((a) => a.approved && !a.dismissed);
    const dismissed = new Set(standing.filter((a) => a.dismissed).map((a) => a.text));

    setApprovedAffirmations(approved);

    if (todayKey === "2026-05-24") {
      setTodayAffirmation("Joanne is very very very cool. Like super cool.");
      setAffirmationStatus("pending");
      return;
    }

    // Check if there's already one for today
    const todayAff = all.find((a) => isToday(a.shown_at));

    if (todayAff) {
      setTodayAffirmation(todayAff.text);
      setAffirmationStatus(todayAff.approved ? "approved" : todayAff.dismissed ? "dismissed" : "pending");
      return;
    }

    const pick = pickAffirmation(todayKey, user?.id || "", {
      seen: new Set(all.map((a) => a.text)),
      approved: approved.map((a) => a.text),
      dismissed,
      lastShown: all[0]?.text,
    });
    if (pick) {
      setTodayAffirmation(pick);
      setAffirmationStatus("pending");
    }
  }, [supabase, todayKey, user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // getSession() reads the token straight out of local storage, so the app
      // paints at once and still opens with no signal. getUser() is a network
      // round trip on every launch — a blank first frame when it's slow, and an
      // instant bounce to /login when there's no connection at all.
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        setUser(session.user);
        return;
      }
      // No stored session. That usually means signed out, but only act on it if
      // we can actually reach the network to confirm.
      const { data: { user: fetched } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (fetched) setUser(fetched);
      else if (navigator.onLine) router.push("/login");
    })();
    return () => { cancelled = true; };
  }, [supabase, router]);

  useEffect(() => {
    if (!user) return;
    // Show the cached journal first, then let the network replace it.
    try {
      const raw = localStorage.getItem(entriesCacheKey(user.id));
      if (raw) {
        const cached: GratitudeEntry[] = JSON.parse(raw);
        if (Array.isArray(cached) && cached.length > 0) {
          setEntries(cached);
          setTodayEntry(cached.find((e) => isToday(e.created_at)) || null);
        }
      }
    } catch {
      /* corrupt or unavailable storage — skip the fast path, load normally */
    }
    loadEntries();
    loadAffirmations();
  }, [user, loadEntries, loadAffirmations]);

  // Keep the offline copy in step with what's on screen. Capped, because the
  // journal grows without limit and localStorage does not.
  useEffect(() => {
    if (!user || entries.length === 0) return;
    try {
      localStorage.setItem(entriesCacheKey(user.id), JSON.stringify(entries.slice(0, 60)));
    } catch {
      /* quota or private browsing — the cache is an optimisation, not a store */
    }
  }, [user, entries]);

  // Serve the next quote from the standing popular-quote pool. Used whenever
  // the calendar has nothing to offer for today — either it carries no quote
  // for this date, or the user removed the one it does carry.
  const showPopularQuote = useCallback((seen: Set<string>, kept: Set<string>) => {
    const pick = pickPopularQuote(todayKey, seen, kept);
    if (!pick) {
      setQuote(null);
      return;
    }
    setQuote({ quote: pick.text, author: pick.author });
    setQuoteStatus("pending");
  }, [todayKey]);

  const loadQuotes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("quotes")
      .select("*")
      .order("shown_at", { ascending: false });
    const all: SavedQuote[] = data || [];
    const approved = all.filter((q) => q.approved && !q.dismissed);
    setApprovedQuotes(approved);
    const kept = new Set(approved.map((q) => q.text));
    const seen = new Set(all.map((q) => q.text));
    setSeenQuotes(seen);

    let calendar: { quote: string; author: string } | null = null;
    // Some accounts don't get the calendar at all — their quotes come from the
    // pool every day. See skipsQuoteCalendar in roles.ts.
    if (!skipsQuoteCalendar(user.email)) try {
      const res = await fetch("/api/quote/today");
      if (res.ok) {
        const d = await res.json();
        if (d?.quote) calendar = { quote: d.quote, author: d.author || "" };
      }
    } catch {
      /* a dead feed is just another empty day — the pool below covers it */
    }

    // The calendar feed is one quote per calendar day, so every quote the user
    // removes would otherwise leave that day permanently blank.
    const existing = calendar ? all.find((q) => q.text === calendar!.quote) : null;
    if (calendar && !existing?.dismissed) {
      setQuote(calendar);
      setQuoteStatus(existing?.approved ? "approved" : "pending");
      return;
    }

    // A pool quote kept today stays today's quote. Without this a reload moved
    // straight past it, because keeping it is what marks it as seen.
    const keptToday = all.find(
      (q) => q.approved && !q.dismissed && isToday(q.shown_at) && q.text !== calendar?.quote
    );
    if (keptToday) {
      setQuote({ quote: keptToday.text, author: keptToday.author || "" });
      setQuoteStatus("approved");
      return;
    }

    showPopularQuote(seen, kept);
  }, [supabase, user, showPopularQuote]);

  useEffect(() => {
    if (user) loadQuotes();
  }, [user, loadQuotes]);

  useEffect(() => {
    if (!user) return;
    setDailyJoke(null);
    if (!seesDailyJoke(user.email)) {
      setJokeCheckedFor(todayKey);
      return;
    }
    let live = true;
    // Pass our local day so the joke turns over at the reader's midnight.
    fetch(`/api/joke/today?date=${todayKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.joke) setDailyJoke(d.joke); })
      .catch(() => { /* a missing joke is not worth an error in the daily view */ })
      .finally(() => { if (live) setJokeCheckedFor(todayKey); });
    return () => { live = false; };
  }, [user, todayKey]);

  useEffect(() => {
    if (!user) return;
    let live = true;
    const safe = (day: string) => listDayMedia(supabase, user.id, day).catch(() => [] as DayMedia[]);
    Promise.all([safe(dayAgo(todayKey, { months: 1 })), safe(dayAgo(todayKey, { years: 1 }))]).then(
      ([monthAgo, yearAgo]) => { if (live) setThrowbackMedia({ monthAgo, yearAgo }); }
    );
    return () => { live = false; };
  }, [supabase, user, todayKey]);

  async function handleQuote(approve: boolean) {
    if (!user || !quote || quoteBusyRef.current) return;
    quoteBusyRef.current = true;
    setQuoteBusy(true);
    try {
      await saveQuoteVerdict(approve);
    } finally {
      quoteBusyRef.current = false;
      setQuoteBusy(false);
    }
  }

  async function saveQuoteVerdict(approve: boolean) {
    if (!user || !quote) return;
    const { data: existing } = await supabase
      .from("quotes")
      .select("id")
      .eq("text", quote.quote)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from("quotes")
        .update({ approved: approve, dismissed: !approve })
        .eq("id", existing[0].id);
    } else {
      await supabase.from("quotes").insert({
        user_id: user.id,
        text: quote.quote,
        author: quote.author || null,
        approved: approve,
        dismissed: !approve,
      });
    }

    const seen = new Set(seenQuotes).add(quote.quote);
    setSeenQuotes(seen);

    if (approve) {
      setQuoteStatus("approved");
      setApprovedQuotes((prev) => {
        if (prev.some((q) => q.text === quote.quote)) return prev;
        return [
          ...prev,
          { id: "temp", text: quote.quote, author: quote.author || null, approved: true, dismissed: false, shown_at: new Date().toISOString() },
        ];
      });
    } else {
      setApprovedQuotes((prev) => prev.filter((q) => q.text !== quote.quote));
      // Removing one shouldn't cost them the day's quote — hand over the next.
      const kept = new Set(approvedQuotes.map((q) => q.text));
      kept.delete(quote.quote);
      showPopularQuote(seen, kept);
    }
  }

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
    setEditDate(toLocalDateStr(new Date(entry.created_at)));
  }

  function cancelEditing() {
    setEditingId(null);
    setEditDate("");
  }

  // Move an entry to another day but keep its original time of day, so a date
  // change can't shunt the entry across a timezone boundary into the wrong day.
  function withLocalDate(originalIso: string, localDate: string) {
    const [y, m, d] = localDate.split("-").map(Number);
    const next = new Date(originalIso);
    next.setFullYear(y, m - 1, d);
    return next.toISOString();
  }

  async function saveEdit(entryId: string) {
    if (!edit1.trim() || !edit2.trim() || !edit3.trim()) return;

    const entry = entries.find((en) => en.id === entryId);
    const originalDate = entry ? toLocalDateStr(new Date(entry.created_at)) : "";
    const dateChanged = Boolean(entry && editDate && editDate !== originalDate);

    // One entry per day — the same rule the past-entry form enforces.
    if (
      dateChanged &&
      entries.some((en) => en.id !== entryId && toLocalDateStr(new Date(en.created_at)) === editDate)
    ) {
      alert("An entry already exists for that date.");
      return;
    }

    setEditSaving(true);
    const { error } = await supabase
      .from("gratitude_entries")
      .update({
        grateful_1: edit1.trim(),
        grateful_2: edit2.trim(),
        grateful_3: edit3.trim(),
        ...(dateChanged && entry ? { created_at: withLocalDate(entry.created_at, editDate) } : {}),
      })
      .eq("id", entryId);

    if (!error) {
      setEditingId(null);
      setEditDate("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await loadEntries();
    } else {
      alert("Error saving: " + error.message);
    }
    setEditSaving(false);
  }

  async function handleAffirmation(approve: boolean) {
    if (!user || !todayAffirmation) return;

    // Check if this affirmation already exists for today.
    //
    // The bounds have to be instants, not bare "YYYY-MM-DD" strings: shown_at
    // is timestamptz, so Postgres reads a bare date as UTC midnight. For anyone
    // logging in the evening west of UTC that window sits a day off and never
    // matched, so every press inserted another row instead of updating today's.
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const { data: existing } = await supabase
      .from("affirmations")
      .select("id")
      .eq("text", todayAffirmation)
      .gte("shown_at", dayStart.toISOString())
      .lt("shown_at", dayEnd.toISOString());

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

  // How many of today's three gratitude lines are logged (0/3 → 3/3).
  // Once today's entry is saved it's complete; otherwise count filled fields live.
  const todayCount = todayEntry
    ? 3
    : [grateful1, grateful2, grateful3].filter((s) => s.trim()).length;
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

  // Jokes are one account's, by request — the tab isn't there for anyone else,
  // and row-level security keeps the rows out of reach even if it were.
  const jokesOwner = ownsJokes(user?.email);
  const tabs: { key: Tab; label: string }[] = [
    { key: "journal", label: "Journal" },
    { key: "korean", label: "Korean" },
    { key: "meditations", label: "Meditations" },
    ...(jokesOwner ? [{ key: "jokes" as Tab, label: "Jokes" }] : []),
  ];

  // One calendar, rendered in two places: a fixed sidebar on wide screens and
  // inline in the journal on phones, where there is no room for a sidebar. It's
  // sized for a phone first and squeezed back down at lg, where the same card
  // has to fit a 208px column.
  const calendarCard = (
      <div className="bg-[var(--surface)] rounded-2xl lg:rounded-xl p-4 lg:p-3 shadow-sm border border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setCalendarMonth(prev => {
              const d = new Date(prev.year, prev.month - 1, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })}
            className="w-8 h-8 lg:w-6 lg:h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors text-base lg:text-xs"
          >
            ‹
          </button>
          <h3 className="text-sm lg:text-[11px] font-medium text-[var(--text)]">
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
            className="w-8 h-8 lg:w-6 lg:h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors text-base lg:text-xs"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 lg:gap-px text-center">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-[10px] lg:text-[8px] text-[var(--text-muted)] font-medium py-0.5">{d}</div>
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
                  className={`relative w-full aspect-square rounded-lg lg:rounded flex items-center justify-center transition-all ${
                    isFuture ? 'text-[var(--text-muted)] opacity-25 cursor-default text-[13px] lg:text-[9px]' :
                    isDayToday ? 'font-bold ring-1.5 ring-[var(--accent)] text-[var(--accent)] text-[14px] lg:text-[10px]' :
                    hasEntry ? 'cursor-pointer hover:opacity-80 text-[14px] lg:text-[10px]' :
                    'cursor-pointer hover:bg-[var(--bg)] text-[var(--text-muted)] text-[13px] lg:text-[9px]'
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
        <div className="flex items-center gap-3 lg:gap-2 mt-3 lg:mt-2 pt-2 border-t border-[var(--border)]">
          <span className="flex items-center gap-1 text-[10px] lg:text-[8px] text-[var(--text-muted)]">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'var(--pastel-sage)' }} /> Logged
          </span>
          <span className="flex items-center gap-1 text-[10px] lg:text-[8px] text-[var(--text-muted)]">
            <span className="w-2 h-2 rounded-sm ring-1 ring-[var(--accent)]" /> Today
          </span>
        </div>
      </div>
  );

  // Kept quotes, one per text. The table holds a row per showing, so the same
  // quote can be kept more than once — the count should be quotes, not rows.
  const savedQuotes = approvedQuotes.filter(
    (q, i) => approvedQuotes.findIndex((x) => x.text === q.text) === i
  );

  // Saved affirmations and quotes. Rendered on the journal page and again in
  // the gear sheet, so it's built once here rather than written out twice.
  const savedCollections = (
    <>
      {/* Approved Affirmations — always rendered. Hiding the section when it
          was empty meant there was nothing on the page to tell you where kept
          affirmations end up, so "none saved" and "feature missing" looked
          identical. */}
      <section className="space-y-3">
        <h3 className="text-xs text-[var(--text-muted)] tracking-widest uppercase">
          Your Affirmations ({approvedAffirmations.length})
        </h3>
        <div className="bg-[var(--surface)] rounded-2xl p-6 shadow-sm border border-[var(--border)]">
          {approvedAffirmations.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Nothing kept yet. Press <span className="text-[var(--text)]">Keep in Rotation</span> on
              today&apos;s affirmation and it&apos;ll be here.
            </p>
          ) : (
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
                    className="text-xs text-[var(--text-muted)] [@media(hover:hover)]:opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all shrink-0"
                    title="Remove from rotation"
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Approved Quotes — always rendered, same reasoning as above. */}
      <section className="space-y-3">
        <h3 className="text-xs text-[var(--text-muted)] tracking-widest uppercase">
          Your Quotes ({savedQuotes.length})
        </h3>
        <div className="bg-[var(--surface)] rounded-2xl p-6 shadow-sm border border-[var(--border)]">
          {savedQuotes.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Nothing kept yet. Press <span className="text-[var(--text)]">Keep in Rotation</span> on
              today&apos;s quote and it&apos;ll be here.
            </p>
          ) : (
            <div className="space-y-4">
              {savedQuotes.map((q) => (
                <div key={q.id} className="flex items-start gap-3 group">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[var(--pastel-rose)]" />
                  <div className="flex-1">
                    <p className="text-sm text-[var(--text)] leading-relaxed italic">
                      {q.text}
                    </p>
                    {q.author && (
                      <p className="text-xs text-[var(--text-muted)] mt-1">— {q.author}</p>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      await supabase
                        .from("quotes")
                        .update({ dismissed: true, approved: false })
                        .eq("text", q.text);
                      setApprovedQuotes((prev) => prev.filter((x) => x.text !== q.text));
                      const seen = new Set(seenQuotes).add(q.text);
                      setSeenQuotes(seen);
                      if (quote && quote.quote === q.text) {
                        showPopularQuote(seen, new Set(approvedQuotes.filter((x) => x.text !== q.text).map((x) => x.text)));
                      }
                    }}
                    className="text-xs text-[var(--text-muted)] [@media(hover:hover)]:opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all shrink-0"
                    title="Remove from rotation"
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );

  return (
    <main className="min-h-screen pb-tabbar md:pb-20">
      {/* Header — sticky, so the streak and sign-out stay reachable without
          scrolling back up, and inset past the notch in standalone mode. */}
      <header className="sticky top-0 z-30 bg-[var(--bg-frosted)] backdrop-blur-md pt-safe">
        <div className="flex items-center justify-between px-6 py-4 max-w-2xl mx-auto">
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
          {/* Settings. What lives here is occasional housekeeping — bringing in a
              journal kept somewhere else — so it sits behind a gear rather than
              taking a tab of its own. */}
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            className="tap-scale text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </button>
        </div>
        </div>
      </header>

      {/* Tab navigation. Two presentations of the same state: a pill row on
          desktop, and on phones a bottom bar, because the top of a tall screen
          is the one place a thumb can't comfortably reach. */}
      <nav className="hidden md:block max-w-2xl mx-auto px-6 mb-8">
        <div className="flex gap-1 p-1 bg-[var(--surface)] rounded-full border border-[var(--border)] w-fit mx-auto">
          {tabs.map((t) => (
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

      <InstallHint />

      <nav
        aria-label="Sections"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--surface-frosted)] backdrop-blur-md pb-safe"
      >
        <div
          className="flex items-stretch justify-around px-1 pt-1.5"
          style={{ minHeight: "var(--tabbar-height)" }}
        >
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  // Switching tabs should land at the top of the new one, the
                  // way a native tab bar behaves.
                  window.scrollTo({ top: 0 });
                }}
                aria-current={active ? "page" : undefined}
                className={`tap-scale flex-1 flex flex-col items-center gap-1 pt-1 pb-1 rounded-xl ${
                  active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                }`}
              >
                <TabIcon tab={t.key} active={active} />
                <span className="text-[10px] leading-none">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 space-y-10">

        {tab === "meditations" && <MeditationsTab />}

        {tab === "jokes" && jokesOwner && user && <JokesTab userId={user.id} />}

        {tab === "korean" && (
          <div className="space-y-8">
            {/* Add a phrase */}
            <section className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)]">
              <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase mb-3">
                Add a Phrase
              </p>
              <form onSubmit={addPhrase} className="space-y-3">
                <input
                  type="text"
                  value={phraseKorean}
                  onChange={(e) => setPhraseKorean(e.target.value)}
                  placeholder="Korean phrase, e.g. 안녕하세요"
                  maxLength={200}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                />
                <input
                  type="text"
                  value={phraseTranslation}
                  onChange={(e) => setPhraseTranslation(e.target.value)}
                  placeholder="Translation (stays hidden until you hold the phrase)"
                  maxLength={200}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                />
                <button
                  type="submit"
                  disabled={!phraseKorean.trim()}
                  className="w-full py-2.5 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                >
                  Save Phrase
                </button>
              </form>
            </section>

            {/* My phrases — hold to reveal the translation */}
            {savedPhrases.length > 0 && (
              <section className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)]">
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase">
                    My Phrases
                  </p>
                  <span className="text-xs text-[var(--text-muted)]">
                    {savedPhrases.length} {savedPhrases.length === 1 ? "phrase" : "phrases"}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mb-4">
                  Press and hold a phrase to reveal its translation.
                </p>
                <div className="space-y-2">
                  {savedPhrases.map((p) => {
                    const revealed = revealedPhraseId === p.id;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0"
                      >
                        <button
                          onClick={() => speakKorean(p.korean)}
                          aria-label={`Play pronunciation of ${p.korean}`}
                          title="Play pronunciation"
                          className="w-7 h-7 shrink-0 rounded-full bg-[var(--bg)] hover:bg-[var(--pastel-sky)] flex items-center justify-center text-sm transition-colors"
                        >
                          🔊
                        </button>
                        <div
                          role="button"
                          tabIndex={0}
                          title="Hold to reveal translation"
                          className="flex-1 min-w-0 cursor-pointer select-none"
                          onPointerDown={() => setRevealedPhraseId(p.id)}
                          onPointerUp={() => setRevealedPhraseId(null)}
                          onPointerLeave={() =>
                            setRevealedPhraseId((cur) => (cur === p.id ? null : cur))
                          }
                          onPointerCancel={() => setRevealedPhraseId(null)}
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          <p className="text-base text-[var(--text)]">{p.korean}</p>
                          <p className="text-sm mt-0.5 min-h-[1.25rem]">
                            {revealed ? (
                              <span className="text-[var(--text-muted)]">
                                {p.translation || "No translation saved"}
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)] opacity-40 italic">
                                Hold to reveal
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => removePhrase(p.id)}
                          aria-label={`Remove ${p.korean}`}
                          title="Remove"
                          className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none transition-colors shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Words You've Learned — from the Word of the Day */}
            {learnedWords.length > 0 && (
              <section className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)]">
                <div className="flex items-baseline justify-between mb-4">
                  <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase">
                    Words You&apos;ve Learned
                  </p>
                  <span className="text-xs text-[var(--text-muted)]">
                    {learnedWords.length} {learnedWords.length === 1 ? "word" : "words"}
                  </span>
                </div>
                <div className="space-y-2">
                  {learnedWords.map((w) => (
                    <div
                      key={w.hangul}
                      className="flex items-center gap-3 py-1.5 border-b border-[var(--border)] last:border-0"
                    >
                      <button
                        onClick={() => speakKorean(w.hangul)}
                        aria-label={`Play pronunciation of ${w.hangul}`}
                        title="Play pronunciation"
                        className="w-7 h-7 shrink-0 rounded-full bg-[var(--bg)] hover:bg-[var(--pastel-sky)] flex items-center justify-center text-sm transition-colors"
                      >
                        🔊
                      </button>
                      <span className="text-base text-[var(--text)] w-20 shrink-0">{w.hangul}</span>
                      <span className="text-xs text-[var(--text-muted)] italic w-24 shrink-0">{w.romanization}</span>
                      <span className="text-sm text-[var(--text)] flex-1">{w.meaning}</span>
                      <button
                        onClick={() => removeLearned(w.hangul)}
                        aria-label={`Remove ${w.hangul}`}
                        title="Remove"
                        className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === "journal" && <>

        {/* Today's Quote + Affirmation, side by side */}
        <div className="grid sm:grid-cols-2 gap-4">

        {/* Today's Quote */}
        {quote && quoteStatus !== "dismissed" && (
          <section className="bg-[var(--pastel-rose)] rounded-2xl p-4 text-center">
            <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase mb-2">
              Today&apos;s Quote
            </p>
            <p className="text-sm font-light text-[var(--text)] leading-relaxed italic">
              &ldquo;{quote.quote}&rdquo;
            </p>
            {quote.author && (
              <p className="text-[10px] text-[var(--text-muted)] mt-2 mb-3">
                — {quote.author}
              </p>
            )}
            {quoteStatus === "pending" ? (
              <div className="flex gap-2 justify-center mt-3">
                <button
                  onClick={() => handleQuote(true)}
                  disabled={quoteBusy}
                  className="disabled:opacity-60 px-4 py-1.5 rounded-full bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Keep in Rotation
                </button>
                <button
                  onClick={() => handleQuote(false)}
                  disabled={quoteBusy}
                  className="disabled:opacity-60 px-4 py-1.5 rounded-full border border-[var(--border)] bg-white text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--pastel-sage)] text-[var(--text)] mt-2">
                ✓ Saved to your rotation
              </div>
            )}
          </section>
        )}

        {/* Daily Affirmation */}
        {todayAffirmation && (
          <section className="bg-[var(--pastel-lavender)] rounded-2xl p-4 text-center">
            <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase mb-2">
              Today&apos;s Affirmation
            </p>
            <p className="text-sm font-light text-[var(--text)] leading-relaxed italic mb-3">
              &ldquo;{todayAffirmation}&rdquo;
            </p>
            {affirmationStatus === "pending" ? (
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => handleAffirmation(true)}
                  className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Keep in Rotation
                </button>
                <button
                  onClick={() => handleAffirmation(false)}
                  className="px-4 py-1.5 rounded-full border border-[var(--border)] bg-white text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
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

        </div>

        {/* Today's Joke — only ever one that's been rated SFW, and only for the
            accounts set up to receive one. */}
        {dailyJoke && (
          <section className="bg-[var(--pastel-sky)] rounded-2xl p-5 text-center">
            <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase mb-2">
              Today&apos;s Joke
            </p>
            <p className="text-sm font-light text-[var(--text)] leading-relaxed whitespace-pre-wrap">
              {dailyJoke.text}
            </p>
            {dailyJoke.punchline && (
              <p className="text-sm font-light text-[var(--text)] leading-relaxed whitespace-pre-wrap mt-2">
                {dailyJoke.punchline}
              </p>
            )}
          </section>
        )}

        {/* No joke today — offer a dad joke to save or throw away instead. */}
        {user && !dailyJoke && jokeCheckedFor === todayKey && (
          <DadJokeCard userId={user.id} todayKey={todayKey} />
        )}

        {/* On this day — a month ago and a year ago, side by side */}
        {(throwbacks.monthAgo || throwbacks.yearAgo ||
          throwbackMedia.monthAgo.length > 0 || throwbackMedia.yearAgo.length > 0) && (
          <section className="bg-[var(--pastel-amber)] rounded-2xl p-6">
            <p className="text-xs text-[var(--text-muted)] tracking-widest uppercase mb-4">
              On This Day
            </p>
            <div className="grid sm:grid-cols-2 gap-6 sm:divide-x divide-[var(--border)]">
              {([
                { label: "A Month Ago Today", entry: throwbacks.monthAgo, media: throwbackMedia.monthAgo },
                { label: "A Year Ago Today", entry: throwbacks.yearAgo, media: throwbackMedia.yearAgo },
              ] as const).map(({ label, entry, media }, col) => (
                <div key={label} className={col === 1 ? "sm:pl-6" : ""}>
                  <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase mb-1">
                    {label}
                  </p>
                  {entry ? (
                    <>
                      <p className="text-xs text-[var(--text-muted)] mb-3">
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
                              <p className="text-sm text-[var(--text)] leading-relaxed italic">
                                {text}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </>
                  ) : !media.length ? (
                    <p className="text-sm text-[var(--text-muted)] italic mt-2">
                      No entry from this day.
                    </p>
                  ) : null}
                  {media.length > 0 && (
                    <div className="mt-3">
                      <MediaGrid media={media} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {user && <TodayMediaCard userId={user.id} todayKey={todayKey} />}

        {/* Today's Entry Form */}
        {!todayEntry ? (
          <section className="bg-[var(--surface)] rounded-2xl p-8 shadow-sm border border-[var(--border)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-light text-[var(--text)] mb-1">
                  Tonight&apos;s Reflection
                </h2>
                <p className="text-xs text-[var(--text-muted)] mb-6">
                  What are three things you&apos;re grateful for today?
                </p>
              </div>
              <span
                className="shrink-0 flex items-center gap-1 text-xs font-medium text-[var(--accent)] bg-[var(--pastel-rose)] px-3 py-1 rounded-full"
                title="Gratitude logged today"
              >
                {todayCount}/3 logged
              </span>
            </div>

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
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] bg-[var(--pastel-rose)] px-3 py-1 rounded-full mb-3">
              3/3 logged
            </span>
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

        {/* Korean word of the day */}
        <section className="bg-[var(--pastel-sky)] rounded-2xl p-5">
          <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase mb-3">
            Korean Word of the Day
          </p>
          <div className="flex items-center gap-4">
            {/* Left: word + audio */}
            <div className="flex items-center gap-2 shrink-0">
              <p className="text-3xl font-light text-[var(--text)] leading-tight">
                {koreanWord.hangul}
              </p>
              <button
                onClick={() => speakKorean(koreanWord.hangul)}
                aria-label="Play pronunciation"
                title="Play pronunciation"
                className="w-8 h-8 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-base transition-colors"
              >
                🔊
              </button>
            </div>
            {/* Right: details */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--text-muted)] italic">
                {koreanWord.romanization}
              </p>
              <p className="text-xs text-[var(--text)] mt-0.5">
                <span className="text-[var(--text-muted)]">Say it: </span>{koreanWord.sound}
              </p>
              <div className="flex items-center gap-3 mt-2">
                {meaningRevealed ? (
                  <>
                    <p className="text-sm text-[var(--text)]">{koreanWord.meaning}</p>
                    <button
                      onClick={toggleLearned}
                      className={`px-4 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
                        isLearned
                          ? "bg-[var(--pastel-sage)] text-[var(--text)]"
                          : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                      }`}
                    >
                      {isLearned ? "✓ Learned" : "Mark as learned"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={revealMeaning}
                    className="px-4 py-1.5 rounded-full border border-[var(--border)] bg-white text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  >
                    Tap to reveal meaning
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Type a phrase → Claude translates + breaks it down */}
          <div className="mt-5 pt-5 border-t border-white/40">
            <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase mb-3">
              Translate a Phrase
            </p>
            <form onSubmit={submitPhrase} className="flex gap-2">
              <input
                type="text"
                value={phraseInput}
                onChange={(e) => setPhraseInput(e.target.value)}
                placeholder="Type an English phrase, e.g. “Where is the bathroom?”"
                maxLength={200}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/70 border border-white text-[var(--text)] text-sm outline-none focus:border-[var(--accent)] transition-colors"
              />
              <button
                type="submit"
                disabled={phraseLoading || !phraseInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 shrink-0"
              >
                {phraseLoading ? "…" : "Translate"}
              </button>
            </form>

            {phraseError && (
              <p className="text-xs text-red-400 mt-3">{phraseError}</p>
            )}

            {phraseResult && (
              <div className="mt-4 space-y-4">
                {/* Whole phrase — formal & informal registers */}
                {phraseResult.formal && phraseResult.informal ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: "Formal", reg: phraseResult.formal },
                      { label: "Informal", reg: phraseResult.informal },
                      ...(phraseResult.slang
                        ? [{ label: "Slang", reg: phraseResult.slang }]
                        : []),
                    ].map(({ label, reg }) => (
                      <div key={label} className="bg-white/50 rounded-xl p-3">
                        <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase mb-1.5">
                          {label}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xl font-light text-[var(--text)] leading-tight">
                            {reg.hangul}
                          </p>
                          <button
                            onClick={() => speakKorean(reg.hangul)}
                            aria-label={`Play ${label.toLowerCase()} pronunciation`}
                            title="Play pronunciation"
                            className="w-7 h-7 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-sm transition-colors shrink-0"
                          >
                            🔊
                          </button>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] italic mt-0.5">
                          {reg.romanization}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                          {reg.note}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-light text-[var(--text)] leading-tight">
                        {phraseResult.hangul}
                      </p>
                      <button
                        onClick={() => speakKorean(phraseResult.hangul)}
                        aria-label="Play pronunciation"
                        title="Play pronunciation"
                        className="w-8 h-8 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-base transition-colors shrink-0"
                      >
                        🔊
                      </button>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] italic -mt-2">
                      {phraseResult.romanization}
                    </p>
                  </>
                )}

                {/* Word-by-word */}
                <div className="space-y-2">
                  {phraseResult.words.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 py-1.5 border-b border-white/40 last:border-0"
                    >
                      <button
                        onClick={() => speakKorean(w.hangul)}
                        aria-label={`Play pronunciation of ${w.hangul}`}
                        title="Play pronunciation"
                        className="w-7 h-7 shrink-0 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-sm transition-colors"
                      >
                        🔊
                      </button>
                      <div className="min-w-0">
                        <p className="text-base text-[var(--text)]">
                          {w.hangul}{" "}
                          <span className="text-xs text-[var(--text-muted)] italic">
                            {w.romanization}
                          </span>{" "}
                          <span className="text-sm text-[var(--text)]">— {w.meaning}</span>
                        </p>
                        <p className="text-xs text-[var(--text)]">
                          <span className="text-[var(--text-muted)]">Say it: </span>
                          {w.sound}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Whole-phrase tip */}
                <p className="text-xs text-[var(--text)]">
                  <span className="text-[var(--text-muted)]">Whole phrase: </span>
                  {phraseResult.wholeTip}
                </p>

                {/* Example */}
                <div className="bg-white/50 rounded-xl p-3">
                  <p className="text-sm text-[var(--text)]">{phraseResult.example.korean}</p>
                  <p className="text-xs text-[var(--text-muted)] italic mt-0.5">
                    {phraseResult.example.english}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

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
          <div className="fixed right-6 bottom-[calc(var(--tabbar-height)+var(--safe-bottom)+1rem)] md:bottom-6 bg-[var(--pastel-sage)] text-[var(--text)] text-sm px-5 py-2.5 rounded-full shadow-md">
            Saved
          </div>
        )}

        {savedCollections}

        {/* Month at a glance. The desktop build parks this in a fixed sidebar,
            which is hidden below lg — so on a phone the same card goes inline,
            right above the history it indexes into. */}
        <div className="lg:hidden">{calendarCard}</div>

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
                    <div>
                      <span className="text-xs text-[var(--text-muted)] block mb-1">Date</span>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        max={toLocalDateStr(new Date())}
                        className="px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--accent)] transition-colors w-full"
                      />
                      {editDate &&
                        editDate !== toLocalDateStr(new Date(entry.created_at)) &&
                        entryDates.has(editDate) && (
                          <p className="text-xs text-red-400 mt-1">An entry already exists for this date.</p>
                        )}
                    </div>
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
                        disabled={
                          editSaving ||
                          !editDate ||
                          (editDate !== toLocalDateStr(new Date(entry.created_at)) &&
                            entryDates.has(editDate))
                        }
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

      {/* Calendar — fixed right sidebar on desktop; the phone build renders
          the same card inline inside the journal tab. */}
      {tab === "journal" && (
        <div className="fixed top-24 right-6 w-52 hidden lg:block">{calendarCard}</div>
      )}

      {showSettings && user && (
        <SettingsSheet
          userId={user.id}
          onClose={() => setShowSettings(false)}
          onImported={loadEntries}
          saved={savedCollections}
        />
      )}
    </main>
  );
}
