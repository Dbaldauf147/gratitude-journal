import { parseICS } from "@/lib/ics";

export const revalidate = 3600;

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
