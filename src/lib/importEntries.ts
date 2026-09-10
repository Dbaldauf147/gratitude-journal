/**
 * Reading a pile of old journal entries into the shape this app stores.
 *
 * History arrives in whatever form the person kept it — a spreadsheet, an
 * export from another app, or years of typed notes — so rather than demand one
 * layout, this sniffs the text and hands back rows the import screen can show
 * for approval before anything is written. Nothing here touches the database;
 * a bad guess costs a glance at the preview, not a cleanup.
 */

export type ImportFormat = "json" | "csv" | "tsv" | "text";

export interface ParsedRow {
  /** Stable across re-parses of the same source, so preview edits survive. */
  key: string;
  /** Local calendar day, `YYYY-MM-DD`. Null when no date could be read. */
  date: string | null;
  /** Whatever the person was grateful for, in source order. Any count. */
  items: string[];
  /** The original snippet, shown when a row can't be read. */
  raw: string;
}

/** Which delimited columns hold the date and the gratitude items. */
export interface ColumnMapping {
  date: number;
  items: number[];
}

export interface ParseResult {
  format: ImportFormat;
  rows: ParsedRow[];
  /** Delimited sources only: header labels and the guessed mapping, so the
   *  screen can offer dropdowns when the guess is wrong. */
  columns?: string[];
  mapping?: ColumnMapping;
}

/* ------------------------------------------------------------------ dates */

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const pad = (n: number) => String(n).padStart(2, "0");

const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Rejects the impossible (Feb 30) rather than letting Date roll it forward. */
function validDay(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const probe = new Date(y, m - 1, d);
  if (probe.getMonth() !== m - 1 || probe.getDate() !== d) return null;
  return ymd(y, m, d);
}

/** Two-digit years: 70–99 are last century, everything else this one. */
const expandYear = (y: number) => (y >= 100 ? y : y >= 70 ? 1900 + y : 2000 + y);

/**
 * A calendar day out of human-written text, or null.
 *
 * Slashed dates are read US-style (M/D/Y). That's ambiguous by nature —
 * 3/4/2024 is two different days depending on where it was written — so the
 * preview shows every parsed date back for checking.
 */
export function parseDate(input: string): string | null {
  let s = (input || "").trim();
  if (!s) return null;

  // Markdown headings, list bullets and a leading weekday are all decoration.
  s = s.replace(/^[#>\s*-]+/, "").trim();
  s = s.replace(/^(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)[a-z]*[,.]?\s+/i, "");
  s = s.replace(/[,.]?\s*$/, "").trim();
  if (!s) return null;

  // A full ISO timestamp is almost certainly this app's own export, so read it
  // as an instant and ask what local day that was.
  const isoStamp = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ]\d{2}:\d{2}/);
  if (isoStamp) {
    const asDate = new Date(s.includes("T") ? s : s.replace(" ", "T"));
    if (!Number.isNaN(asDate.getTime())) {
      return ymd(asDate.getFullYear(), asDate.getMonth() + 1, asDate.getDate());
    }
  }

  // Bare YYYY-MM-DD is taken literally — running it through Date would read it
  // as UTC midnight and hand back the previous day west of Greenwich.
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return validDay(+iso[1], +iso[2], +iso[3]);

  const slashed = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (slashed) return validDay(expandYear(+slashed[3]), +slashed[1], +slashed[2]);

  // "January 5, 2024" / "Jan 5 2024"
  const monthFirst = s.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(\d{2,4})$/i);
  if (monthFirst) {
    const m = MONTHS.findIndex((name) => name.startsWith(monthFirst[1].toLowerCase()));
    if (m >= 0) return validDay(expandYear(+monthFirst[3]), m + 1, +monthFirst[2]);
  }

  // "5 January 2024"
  const dayFirst = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?[,\s]+(\d{2,4})$/i);
  if (dayFirst) {
    const m = MONTHS.findIndex((name) => name.startsWith(dayFirst[2].toLowerCase()));
    if (m >= 0) return validDay(expandYear(+dayFirst[3]), m + 1, +dayFirst[1]);
  }

  return null;
}

/**
 * The timestamp stored for an imported day: local noon.
 *
 * The date is what matters here, and noon is the one time of day that survives
 * every timezone — pick midnight and the entry lands on the day before or
 * after for anyone whose clock is offset from UTC.
 */
export function timestampForDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

/* ------------------------------------------------------------- delimiters */

/** RFC 4180 split — quoted fields may hold the delimiter, newlines and "". */
function splitDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);

  // Trailing newline leaves one empty row; so do blank lines mid-file.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const DATE_HEADERS = ["date", "day", "created_at", "createdat", "created", "entry date", "entry_date", "timestamp", "time", "when"];

const ITEM_HEADER = /^(grateful|gratitude|thankful|thing|item|entry|text|note)/i;

/** Guess which columns to read, by header name and then by content. */
function guessMapping(header: string[], sample: string[][]): ColumnMapping {
  const normalized = header.map((h) => h.trim().toLowerCase());

  let date = normalized.findIndex((h) => DATE_HEADERS.includes(h));
  if (date < 0) date = normalized.findIndex((h) => h.includes("date"));
  // No usable header: fall back to whichever column actually holds dates.
  if (date < 0) {
    date = header.findIndex((_, i) => sample.some((r) => parseDate(r[i] || "")));
  }

  let items = normalized
    .map((h, i) => (i !== date && ITEM_HEADER.test(h) ? i : -1))
    .filter((i) => i >= 0);

  // Nothing named like a gratitude column — take every other column that holds
  // text, which is the shape of a headerless "date, thing, thing, thing" file.
  if (items.length === 0) {
    items = header.map((_, i) => i).filter((i) => i !== date);
  }

  return { date: date < 0 ? 0 : date, items };
}

/** Does the first row read as labels rather than data? */
function looksLikeHeader(first: string[], rest: string[][]): boolean {
  if (first.some((c) => parseDate(c))) return false;
  const normalized = first.map((c) => c.trim().toLowerCase());
  if (normalized.some((c) => DATE_HEADERS.includes(c) || ITEM_HEADER.test(c))) return true;
  // Short, wordless cells above longer prose is the other tell.
  const firstLen = first.join("").length;
  const restLen = rest.length ? rest[0].join("").length : 0;
  return restLen > 0 && firstLen * 3 < restLen;
}

function parseDelimited(text: string, delim: string, override?: ColumnMapping): ParseResult {
  const format: ImportFormat = delim === "\t" ? "tsv" : "csv";
  const grid = splitDelimited(text, delim);
  if (grid.length === 0) return { format, rows: [] };

  const headed = looksLikeHeader(grid[0], grid.slice(1));
  const header = headed
    ? grid[0].map((c) => c.trim())
    : grid[0].map((_, i) => `Column ${i + 1}`);
  const body = headed ? grid.slice(1) : grid;

  const mapping = override || guessMapping(header, body.slice(0, 20));

  const rows = body.map((cells, i) => ({
    key: `d${i}`,
    date: parseDate(cells[mapping.date] || ""),
    items: mapping.items.map((c) => (cells[c] || "").trim()).filter(Boolean),
    raw: cells.join(delim === "\t" ? "  |  " : ", "),
  }));

  return { format, rows, columns: header, mapping };
}

/* ------------------------------------------------------------------- JSON */

const DATE_KEYS = ["date", "created_at", "createdAt", "day", "entry_date", "entryDate", "timestamp", "time", "when"];
const LIST_KEYS = ["items", "entries", "gratitudes", "gratitude", "things", "list", "answers"];
const TEXT_KEYS = ["text", "body", "content", "note", "notes", "entry"];

function itemsFromObject(obj: Record<string, unknown>): string[] {
  // The shape this app stores, and the numbered variants of it.
  const numbered = Object.keys(obj)
    .filter((k) => /^(grateful|gratitude|thankful|item|thing)[_-]?\d+$/i.test(k))
    .sort();
  if (numbered.length) {
    return numbered.map((k) => String(obj[k] ?? "").trim()).filter(Boolean);
  }

  for (const k of LIST_KEYS) {
    const v = obj[k];
    if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  }

  for (const k of TEXT_KEYS) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return splitFreeItems(v);
  }

  return [];
}

function parseJson(text: string): ParseResult | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }

  // A bare object may be a wrapper around the array, or a date-keyed map.
  let list: unknown[] | null = Array.isArray(data) ? data : null;
  if (!list && data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const wrapped = LIST_KEYS.concat("data", "journal", "records", "rows")
      .map((k) => obj[k])
      .find(Array.isArray) as unknown[] | undefined;
    if (wrapped) {
      list = wrapped;
    } else {
      const mapped = Object.entries(obj).filter(([k]) => parseDate(k));
      if (mapped.length) {
        return {
          format: "json",
          rows: mapped.map(([k, v], i) => ({
            key: `j${i}`,
            date: parseDate(k),
            items: Array.isArray(v)
              ? v.map((x) => String(x ?? "").trim()).filter(Boolean)
              : typeof v === "string"
                ? splitFreeItems(v)
                : itemsFromObject((v || {}) as Record<string, unknown>),
            raw: `${k}: ${JSON.stringify(v)}`,
          })),
        };
      }
    }
  }

  if (!list) return null;

  const rows = list.map((raw, i): ParsedRow => {
    if (typeof raw === "string") {
      return { key: `j${i}`, date: null, items: splitFreeItems(raw), raw };
    }
    const obj = (raw || {}) as Record<string, unknown>;
    const dateKey = DATE_KEYS.find((k) => obj[k] != null);
    return {
      key: `j${i}`,
      date: dateKey ? parseDate(String(obj[dateKey])) : null,
      items: itemsFromObject(obj),
      raw: JSON.stringify(raw),
    };
  });

  return { format: "json", rows };
}

/* -------------------------------------------------------------- free text */

/** One line or blob of prose into separate gratitude items. */
function splitFreeItems(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•·–—]|\(?\d{1,2}[.)])\s*/, "").trim())
    .filter(Boolean);

  // Multi-line is already a list. A single line usually separates on ; or |.
  if (lines.length > 1) return lines;
  const one = lines[0] || "";
  if (!one) return [];
  const parts = one.split(/\s*[;|]\s*/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [one];
}

/**
 * Typed-up notes: a date, then the things, repeating. Blocks separated by blank
 * lines are tried first; failing that, every line is read as "date, then items".
 */
function parseText(text: string): ParseResult {
  const blocks = text.split(/\r?\n\s*\r?\n/).map((b) => b.trim()).filter(Boolean);

  const blockRows: ParsedRow[] = [];
  let blocksLookRight = false;

  blocks.forEach((block, i) => {
    const lines = block.split(/\r?\n/);
    const date = parseDate(lines[0]);
    if (date) {
      blocksLookRight = true;
      blockRows.push({
        key: `t${i}`,
        date,
        items: splitFreeItems(lines.slice(1).join("\n")),
        raw: block,
      });
    } else {
      blockRows.push({ key: `t${i}`, date: null, items: splitFreeItems(block), raw: block });
    }
  });

  // A date on the first line of most blocks means the guess was right.
  if (blocksLookRight && blockRows.filter((r) => r.date).length * 2 >= blockRows.length) {
    return { format: "text", rows: blockRows };
  }

  // Otherwise: one entry per line, the date up front, separated by : - or a tab.
  const lineRows: ParsedRow[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const split = line.match(/^(.{4,30}?)\s*(?:[:\t]|\s[-–—]\s)\s*(.+)$/);
    const date = split ? parseDate(split[1]) : null;
    if (date) {
      lineRows.push({ key: `l${i}`, date, items: splitFreeItems(split![2]), raw: line });
    } else {
      lineRows.push({ key: `l${i}`, date: null, items: splitFreeItems(line), raw: line });
    }
  });

  const dated = lineRows.filter((r) => r.date).length;
  if (dated > blockRows.filter((r) => r.date).length) return { format: "text", rows: lineRows };
  return { format: "text", rows: blockRows };
}

/* ----------------------------------------------------------------- public */

/** Which of the four shapes the pasted text is, before parsing it properly. */
export function detectFormat(text: string): ImportFormat {
  const trimmed = text.trim();
  if (!trimmed) return "text";
  if (/^[[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not valid JSON after all — fall through and treat it as prose.
    }
  }

  // Count separators on the first handful of lines: a real table uses the same
  // number on every row, which prose almost never does. Separators inside a
  // quoted cell don't count — "Talked to Dad, finally" is one field, and
  // counting its comma made every properly quoted CSV look like prose.
  const lines = trimmed.split(/\r?\n/).slice(0, 12).filter((l) => l.trim());
  const tabular = (delim: string) => {
    if (lines.length < 2) return false;
    const counts = lines.map((line) => {
      let n = 0;
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') quoted = !quoted;
        else if (line[i] === delim && !quoted) n++;
      }
      return n;
    });
    // The commonest column count has to be a real one and shared by nearly
    // every line — one ragged row shouldn't disqualify the whole file.
    const tally = new Map<number, number>();
    counts.forEach((c) => tally.set(c, (tally.get(c) || 0) + 1));
    let best = 0;
    let bestSeen = 0;
    tally.forEach((seen, count) => {
      if (seen > bestSeen) {
        best = count;
        bestSeen = seen;
      }
    });
    return best > 0 && bestSeen >= Math.ceil(lines.length * 0.8);
  };
  if (tabular("\t")) return "tsv";
  if (tabular(",")) return "csv";
  return "text";
}

/**
 * Read pasted or uploaded history into preview rows.
 *
 * `mapping` re-reads a delimited source with columns chosen by hand, for when
 * the guess picked the wrong ones.
 */
export function parseImport(text: string, mapping?: ColumnMapping): ParseResult {
  const format = detectFormat(text);
  if (format === "json") {
    const parsed = parseJson(text);
    if (parsed) return parsed;
  }
  if (format === "csv" || format === "tsv") {
    return parseDelimited(text, format === "tsv" ? "\t" : ",", mapping);
  }
  return parseText(text);
}

/**
 * Fold any number of items into the three columns the table stores. A short day
 * leaves blanks; a long one keeps the overflow rather than dropping it.
 */
export function toColumns(items: string[]): [string, string, string] {
  const clean = items.map((i) => i.trim()).filter(Boolean);
  if (clean.length <= 3) {
    return [clean[0] || "", clean[1] || "", clean[2] || ""];
  }
  return [clean[0], clean[1], clean.slice(2).join("; ")];
}
