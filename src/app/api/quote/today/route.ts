export const revalidate = 3600;

type VEvent = { summary?: string; description?: string; dtstart?: string };

function parseICS(text: string): VEvent[] {
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events: VEvent[] = [];
  let current: VEvent | null = null;

  const unescape = (s: string) =>
    s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

  for (const raw of lines) {
    const line = raw;
    if (line === "BEGIN:VEVENT") {
      current = {};
    } else if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const keyPart = line.slice(0, idx);
      const val = line.slice(idx + 1);
      const key = keyPart.split(";")[0];
      if (key === "SUMMARY") current.summary = unescape(val).trim();
      else if (key === "DESCRIPTION") current.description = unescape(val).trim();
      else if (key === "DTSTART") current.dtstart = val.trim();
    }
  }
  return events;
}

export async function GET() {
  const url = process.env.QUOTES_ICAL_URL;
  if (!url) {
    return Response.json({ error: "QUOTES_ICAL_URL not set" }, { status: 500 });
  }

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    return Response.json({ error: "Failed to fetch calendar" }, { status: 502 });
  }

  const text = await res.text();
  const events = parseICS(text);

  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  const match = events.find((e) => {
    if (!e.dtstart || e.dtstart.length < 8) return false;
    return e.dtstart.slice(4, 6) === mm && e.dtstart.slice(6, 8) === dd;
  });

  if (!match) return Response.json({ quote: null, author: null });

  return Response.json({
    quote: match.summary || "",
    author: match.description || "",
  });
}
