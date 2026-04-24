// Minimal RFC-4180-ish CSV parser. Supports quoted fields with embedded
// commas, CRLF/LF line endings, and doubled-quote escaping ("").
// Header row is required.

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const cleaned = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (cleaned.length === 0) return [];

  const header = cleaned[0].map((h) => h.trim());
  return cleaned.slice(1).map((r) => {
    const obj: CsvRow = {};
    header.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

export function toCsv(rows: CsvRow[], columns: string[]): string {
  const esc = (v: string) =>
    /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const header = columns.join(",");
  const body = rows
    .map((r) => columns.map((c) => esc(r[c] ?? "")).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}
