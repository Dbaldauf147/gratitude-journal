/**
 * The journal as an Excel workbook.
 *
 * A real .xlsx rather than a CSV: Excel opens a CSV with whatever encoding and
 * date order the machine's locale guesses, which mangles anything past ASCII
 * and swaps day/month for half the world. An .xlsx carries its own text and
 * stores the date as a date, so sorting and filtering by it just work.
 *
 * No dependency — the format is a handful of XML files in a zip, and this
 * writes only the parts one plain sheet needs. Pure: never touches Supabase.
 */

import { writeZip } from "@/lib/zip";

export interface ExportEntry {
  created_at: string;
  grateful_1: string | null;
  grateful_2: string | null;
  grateful_3: string | null;
}

const HEADERS = ["Date", "Grateful for #1", "Grateful for #2", "Grateful for #3"];
const WIDTHS = [14, 50, 50, 50];

// Indexes into cellXfs in STYLES.
const HEADER_STYLE = 1;
const DATE_STYLE = 2;
const TEXT_STYLE = 3;

/** XML-safe text. Control characters other than tab/newline are illegal in
 *  XML 1.0 and make Excel refuse the whole file, so they're dropped. */
function escapeXml(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnLetter(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

/** Excel's day number for the local calendar day of this timestamp — the
 *  same day the journal files it under. */
function excelDate(timestamp: string): number {
  const d = new Date(timestamp);
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc - Date.UTC(1899, 11, 30)) / 86400000);
}

function textCell(ref: string, value: string, style: number): string {
  // xml:space keeps leading/trailing spaces Excel would otherwise trim.
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheetXml(entries: ExportEntry[]): string {
  const rows: string[] = [
    `<row r="1">${HEADERS.map((h, i) => textCell(`${columnLetter(i)}1`, h, HEADER_STYLE)).join("")}</row>`,
  ];
  entries.forEach((entry, i) => {
    const r = i + 2;
    const items = [entry.grateful_1, entry.grateful_2, entry.grateful_3];
    rows.push(
      `<row r="${r}"><c r="A${r}" s="${DATE_STYLE}"><v>${excelDate(entry.created_at)}</v></c>` +
        items.map((item, j) => textCell(`${columnLetter(j + 1)}${r}`, item ?? "", TEXT_STYLE)).join("") +
        `</row>`
    );
  });
  const last = `${columnLetter(HEADERS.length - 1)}${entries.length + 1}`;
  const cols = WIDTHS.map(
    (w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`
  ).join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${rows.join("")}</sheetData>` +
    `<autoFilter ref="A1:${last}"/>` +
    `</worksheet>`
  );
}

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="4">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WORKBOOK =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
  `<sheets><sheet name="Gratitude Journal" sheetId="1" r:id="rId1"/></sheets>` +
  `</workbook>`;

const WORKBOOK_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The workbook's bytes: one sheet, a row per day, oldest first. */
export function buildWorkbook(entries: ExportEntry[]): Uint8Array {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const encoder = new TextEncoder();
  const file = (name: string, xml: string) => ({ name, bytes: encoder.encode(xml) });
  return writeZip([
    file("[Content_Types].xml", CONTENT_TYPES),
    file("_rels/.rels", ROOT_RELS),
    file("xl/workbook.xml", WORKBOOK),
    file("xl/_rels/workbook.xml.rels", WORKBOOK_RELS),
    file("xl/styles.xml", STYLES),
    file("xl/worksheets/sheet1.xml", sheetXml(sorted)),
  ]);
}
