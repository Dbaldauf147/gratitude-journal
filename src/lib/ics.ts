/**
 * A small iCalendar reader — enough of RFC 5545 for what Google Calendar
 * exports, and nothing more.
 *
 * Lives here rather than inside a route because two callers now need it: the
 * quote-of-the-day route fetches a calendar by URL, and the Jokes tab reads a
 * .ics file the user exported by hand.
 */

export interface VEvent {
  uid?: string;
  summary?: string;
  description?: string;
  dtstart?: string;
}

const unescapeText = (s: string) =>
  s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");

export function parseICS(text: string): VEvent[] {
  // Long values are wrapped onto continuation lines that start with a space or
  // tab. Join them back before anything else, or a joke splits mid-word.
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events: VEvent[] = [];
  let current: VEvent | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
    } else if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      // A property can carry parameters — DTSTART;VALUE=DATE:20260804 — so the
      // name is whatever precedes the first semicolon.
      const key = line.slice(0, idx).split(";")[0];
      const val = line.slice(idx + 1);
      if (key === "SUMMARY") current.summary = unescapeText(val).trim();
      else if (key === "DESCRIPTION") current.description = unescapeText(val).trim();
      else if (key === "DTSTART") current.dtstart = val.trim();
      else if (key === "UID") current.uid = val.trim();
    }
  }
  return events;
}

/** YYYYMMDD or YYYYMMDDTHHMMSSZ → YYYY-MM-DD. Null if there's no usable date. */
export function icsDate(dtstart?: string): string | null {
  if (!dtstart || dtstart.length < 8) return null;
  const d = dtstart.slice(0, 8);
  if (!/^\d{8}$/.test(d)) return null;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}
