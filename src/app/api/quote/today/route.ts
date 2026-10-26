import { parseICS } from "@/lib/ics";

export const revalidate = 3600;

export async function GET(req: Request) {
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

  // `?date=YYYY-MM-DD` looks up another day — the journal's day view uses it
  // to show a past day's quote. Without it, today.
  const date = (new URL(req.url).searchParams.get("date") || "").trim();
  const today = new Date();
  const [mm, dd] = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? [date.slice(5, 7), date.slice(8, 10)]
    : [String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")];

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
