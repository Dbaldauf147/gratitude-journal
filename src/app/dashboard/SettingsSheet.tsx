"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  parseImport,
  toColumns,
  timestampForDate,
  type ColumnMapping,
  type ParsedRow,
  type ParseResult,
} from "@/lib/importEntries";

/** How an imported day that already has an entry is handled. */
type OnDuplicate = "skip" | "replace";

/** Why a parsed row can't be written, or that it can. */
type RowState = "ready" | "existing" | "repeat" | "no-date" | "empty";

const STATE_LABEL: Record<RowState, string> = {
  ready: "New",
  existing: "Already saved",
  repeat: "Repeat in file",
  "no-date": "Needs a date",
  empty: "Nothing to save",
};

const STATE_STYLE: Record<RowState, string> = {
  ready: "bg-[var(--pastel-sage)] text-[var(--text)]",
  existing: "bg-[var(--pastel-amber)] text-[var(--text)]",
  repeat: "bg-[var(--pastel-amber)] text-[var(--text)]",
  "no-date": "bg-[var(--pastel-rose)] text-[var(--text)]",
  empty: "bg-[var(--pastel-rose)] text-[var(--text)]",
};

const prettyDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/** Rows written per round trip. Large enough to be quick, small enough that a
 *  failure names a handful of days rather than the whole file. */
const CHUNK = 50;

/** Past this, a file is parsed but not echoed into the textarea. */
const BIG_FILE = 20000;

/** Preview rows actually rendered. Everything found still gets imported — this
 *  only stops a decade of journalling from putting 4,000 nodes on the page. */
const PREVIEW_LIMIT = 300;

export default function SettingsSheet({
  userId,
  onClose,
  onImported,
}: {
  userId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const fileInput = useRef<HTMLInputElement>(null);

  // Two copies on purpose: `text` is what the box shows, `source` is what gets
  // parsed. A years-long journal pasted into a textarea re-renders on every
  // keystroke, so a large file is parsed without ever being put in the box.
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [onDuplicate, setOnDuplicate] = useState<OnDuplicate>("skip");
  const [note, setNote] = useState("");

  // Every day already in the journal, so the preview can say which of these
  // the person has written before — and so "replace" knows what to update.
  const [existing, setExisting] = useState<Map<string, string> | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<string>("");

  // Esc closes, and the page behind shouldn't scroll while this is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const loadExisting = useCallback(async () => {
    const found = new Map<string, string>();
    // Supabase caps a request at 1000 rows; a long-running journal is more.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("gratitude_entries")
        .select("id, created_at")
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      if (error) {
        setNote("Couldn't check which days you already have. Check your connection.");
        return;
      }
      for (const row of data || []) {
        const d = new Date(row.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        // First one wins: if a day somehow has two, the older is the entry.
        if (!found.has(key)) found.set(key, row.id);
      }
      if (!data || data.length < 1000) break;
    }
    setExisting(found);
  }, [supabase]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  function read(raw: string, name: string) {
    setSourceName(name);
    setSource(raw);
    // Mirror it back into the box only when it's small enough to edit there.
    setText(raw.length > BIG_FILE ? "" : raw);
    setSummary("");
    const result = parseImport(raw);
    setParsed(result);
    setRows(result.rows);
    setSkipped(new Set());
    setNote(result.rows.length === 0 ? "Nothing readable in that — check the format below." : "");
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    read(await file.text(), file.name);
  }

  /** Re-read a spreadsheet with columns picked by hand. */
  function remap(mapping: ColumnMapping) {
    const result = parseImport(source, mapping);
    setParsed(result);
    setRows(result.rows);
    setSkipped(new Set());
  }

  function setRowDate(key: string, date: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, date: date || null } : r)));
  }

  // A day repeated inside the file itself: the first one is the keeper.
  const states = useMemo(() => {
    const seen = new Set<string>();
    const map = new Map<string, RowState>();
    for (const row of rows) {
      let state: RowState;
      if (!row.date) state = "no-date";
      else if (row.items.filter((i) => i.trim()).length === 0) state = "empty";
      else if (seen.has(row.date)) state = "repeat";
      else if (existing?.has(row.date)) state = "existing";
      else state = "ready";
      if (row.date && state !== "repeat") seen.add(row.date);
      map.set(row.key, state);
    }
    return map;
  }, [rows, existing]);

  /** Rows that would actually be written, given the duplicate rule and any
   *  boxes that were unticked. */
  const willWrite = useMemo(
    () =>
      rows.filter((r) => {
        if (skipped.has(r.key)) return false;
        const state = states.get(r.key);
        return state === "ready" || (state === "existing" && onDuplicate === "replace");
      }),
    [rows, skipped, states, onDuplicate]
  );

  const counts = useMemo(() => {
    const tally: Record<RowState, number> = { ready: 0, existing: 0, repeat: 0, "no-date": 0, empty: 0 };
    states.forEach((state) => tally[state]++);
    return tally;
  }, [states]);

  async function runImport() {
    if (!willWrite.length || progress) return;
    setNote("");
    setSummary("");
    setProgress({ done: 0, total: willWrite.length });

    const inserts = willWrite.filter((r) => states.get(r.key) === "ready");
    const updates = willWrite.filter((r) => states.get(r.key) === "existing");

    let added = 0;
    let replaced = 0;
    let failed = 0;
    let firstError = "";

    for (let i = 0; i < inserts.length; i += CHUNK) {
      const batch = inserts.slice(i, i + CHUNK).map((r) => {
        const [g1, g2, g3] = toColumns(r.items);
        return {
          user_id: userId,
          grateful_1: g1,
          grateful_2: g2,
          grateful_3: g3,
          created_at: timestampForDate(r.date!),
        };
      });
      const { error } = await supabase.from("gratitude_entries").insert(batch);
      if (error) {
        failed += batch.length;
        firstError ||= error.message;
      } else {
        added += batch.length;
      }
      setProgress({ done: added + replaced + failed, total: willWrite.length });
    }

    for (const row of updates) {
      const [g1, g2, g3] = toColumns(row.items);
      const { error } = await supabase
        .from("gratitude_entries")
        .update({ grateful_1: g1, grateful_2: g2, grateful_3: g3 })
        .eq("id", existing!.get(row.date!)!);
      if (error) {
        failed++;
        firstError ||= error.message;
      } else {
        replaced++;
      }
      setProgress({ done: added + replaced + failed, total: willWrite.length });
    }

    setProgress(null);
    const parts = [
      added ? `${added} ${added === 1 ? "day" : "days"} added` : "",
      replaced ? `${replaced} rewritten` : "",
      failed ? `${failed} failed` : "",
    ].filter(Boolean);
    setSummary(parts.join(", ") + (firstError ? ` — ${firstError}` : ""));

    if (added || replaced) {
      // Clear the source so the same file can't be run twice by accident, and
      // pull the journal fresh so the new days show up behind this sheet.
      setRows([]);
      setParsed(null);
      setText("");
      setSource("");
      setSourceName("");
      await loadExisting();
      onImported();
    }
  }

  const mapping = parsed?.mapping;
  const columns = parsed?.columns;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full md:max-w-2xl max-h-[90vh] md:max-h-[85vh] overflow-y-auto bg-[var(--surface)] rounded-t-3xl md:rounded-3xl border border-[var(--border)] shadow-xl pb-safe">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[var(--surface-frosted)] backdrop-blur-md border-b border-[var(--border)]">
          <h2 className="text-lg font-light text-[var(--text)]">Settings</h2>
          <button
            onClick={onClose}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Done
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          <section className="space-y-4">
            <div>
              <h3 className="text-base text-[var(--text)]">Import past entries</h3>
              <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
                Bring in a journal you kept somewhere else. Paste it or pick a file — a
                spreadsheet, a JSON export, or plain notes with a date above each day. Nothing is
                saved until you look the list over.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => fileInput.current?.click()}
                className="text-sm px-4 py-2 rounded-full border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
              >
                Choose a file
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.tsv,.txt,.json,.md,text/*,application/json"
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  // Same file twice in a row still fires a change event.
                  e.target.value = "";
                }}
              />
              {sourceName && (
                <span className="text-xs text-[var(--text-muted)]">{sourceName}</span>
              )}
            </div>

            <div className="space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder={"2024-01-05\nA long walk\nCoffee on the porch\nA call from Mom\n\n2024-01-06\n..."}
                className="w-full px-4 py-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-y"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => read(text, "Pasted text")}
                  disabled={!text.trim()}
                  className="text-sm px-5 py-2 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Read entries
                </button>
                {source.length > BIG_FILE && (
                  <span className="text-xs text-[var(--text-muted)]">
                    That file was too long to show here — it&apos;s all in the list below.
                  </span>
                )}
              </div>
            </div>

            {note && <p className="text-sm text-[var(--text)]">{note}</p>}

            {summary && (
              <p className="text-sm text-[var(--text)] bg-[var(--pastel-sage)] rounded-2xl px-4 py-3">
                {summary}
              </p>
            )}

            {/* Column pickers, for a spreadsheet whose headers we guessed wrong. */}
            {parsed && columns && mapping && (
              <div className="rounded-2xl bg-[var(--bg)] border border-[var(--border)] p-4 space-y-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Read as a {parsed.format === "tsv" ? "tab-separated" : "comma-separated"} table.
                  Pick different columns if these are wrong.
                </p>
                <label className="flex items-center gap-3 text-sm text-[var(--text)]">
                  <span className="w-20 shrink-0 text-[var(--text-muted)]">Date</span>
                  <select
                    value={mapping.date}
                    onChange={(e) =>
                      remap({ ...mapping, date: Number(e.target.value), items: mapping.items.filter((i) => i !== Number(e.target.value)) })
                    }
                    className="flex-1 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
                  >
                    {columns.map((c, i) => (
                      <option key={i} value={i}>{c || `Column ${i + 1}`}</option>
                    ))}
                  </select>
                </label>
                <div className="flex items-start gap-3 text-sm">
                  <span className="w-20 shrink-0 text-[var(--text-muted)] pt-1">Grateful for</span>
                  <div className="flex flex-wrap gap-2">
                    {columns.map((c, i) =>
                      i === mapping.date ? null : (
                        <button
                          key={i}
                          onClick={() =>
                            remap({
                              ...mapping,
                              items: mapping.items.includes(i)
                                ? mapping.items.filter((x) => x !== i)
                                : [...mapping.items, i].sort((a, b) => a - b),
                            })
                          }
                          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                            mapping.items.includes(i)
                              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                              : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                          }`}
                        >
                          {c || `Column ${i + 1}`}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {rows.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                  <span className="text-sm text-[var(--text)]">{rows.length} found</span>
                  {counts.ready > 0 && <span>{counts.ready} new</span>}
                  {counts.existing > 0 && <span>{counts.existing} already saved</span>}
                  {counts.repeat > 0 && <span>{counts.repeat} repeated</span>}
                  {counts["no-date"] > 0 && <span>{counts["no-date"]} without a date</span>}
                  {counts.empty > 0 && <span>{counts.empty} empty</span>}
                </div>

                {counts.existing > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(["skip", "replace"] as OnDuplicate[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setOnDuplicate(mode)}
                        className={`px-4 py-1.5 rounded-full text-xs border transition-colors ${
                          onDuplicate === mode
                            ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                            : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                        }`}
                      >
                        {mode === "skip" ? "Keep days I already wrote" : "Overwrite those days"}
                      </button>
                    ))}
                  </div>
                )}

                <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {rows.slice(0, PREVIEW_LIMIT).map((row) => {
                    const state = states.get(row.key)!;
                    const writable =
                      state === "ready" || (state === "existing" && onDuplicate === "replace");
                    const included = writable && !skipped.has(row.key);
                    return (
                      <li
                        key={row.key}
                        className={`rounded-2xl border p-3 transition-opacity ${
                          included ? "border-[var(--border)]" : "border-[var(--border)] opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <input
                            type="checkbox"
                            checked={included}
                            disabled={!writable}
                            onChange={() =>
                              setSkipped((prev) => {
                                const next = new Set(prev);
                                if (next.has(row.key)) next.delete(row.key);
                                else next.add(row.key);
                                return next;
                              })
                            }
                            className="w-4 h-4 accent-[var(--accent)]"
                            aria-label={`Include ${row.date || "this entry"}`}
                          />
                          <input
                            type="date"
                            value={row.date || ""}
                            onChange={(e) => setRowDate(row.key, e.target.value)}
                            className="px-2 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)]"
                          />
                          {row.date && (
                            <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
                              {prettyDate(row.date)}
                            </span>
                          )}
                          <span
                            className={`ml-auto text-[10px] px-2 py-1 rounded-full ${STATE_STYLE[state]}`}
                          >
                            {STATE_LABEL[state]}
                          </span>
                        </div>
                        {row.items.length > 0 ? (
                          <ol className="mt-2 pl-8 space-y-0.5 text-sm text-[var(--text)] list-decimal marker:text-[var(--text-muted)]">
                            {row.items.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ol>
                        ) : (
                          <p className="mt-2 pl-8 text-xs text-[var(--text-muted)] break-words">
                            {row.raw.slice(0, 200)}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {rows.length > PREVIEW_LIMIT && (
                  <p className="text-xs text-[var(--text-muted)]">
                    Showing the first {PREVIEW_LIMIT}. The other {rows.length - PREVIEW_LIMIT} are
                    counted above and will be saved too.
                  </p>
                )}

                <button
                  onClick={runImport}
                  disabled={!willWrite.length || !!progress || existing === null}
                  className="w-full py-3 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {progress
                    ? `Saving ${progress.done} of ${progress.total}...`
                    : existing === null
                      ? "Checking your journal..."
                      : willWrite.length
                        ? `Save ${willWrite.length} ${willWrite.length === 1 ? "day" : "days"}`
                        : "Nothing selected"}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
