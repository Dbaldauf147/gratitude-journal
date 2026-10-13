/**
 * Just enough ZIP to open what Google Calendar hands you.
 *
 * The export downloads as a .zip containing one .ics per calendar, so telling
 * people to unzip it first is asking them to do a step the browser can do
 * itself — and the failure when they don't is a file that reads as binary
 * noise and an error that can't say why.
 *
 * Deliberately no dependency: DecompressionStream has been in every current
 * browser since 2023 and handles the only compression method Google uses.
 * Stored (uncompressed) entries are handled directly.
 */

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

const EOCD_SIG = 0x06054b50;
const CDH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

/** Is this a ZIP? Checked on the bytes, since an extension can lie. */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length > 4
    && bytes[0] === 0x50 && bytes[1] === 0x4b
    && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Every file in the archive whose name matches `filter`.
 *
 * Read through the central directory rather than by scanning for local header
 * signatures — those bytes can occur inside compressed data, and a scanner
 * trips over them.
 */
export async function readZip(
  bytes: Uint8Array,
  filter: (name: string) => boolean = () => true
): Promise<ZipEntry[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // The end-of-central-directory record sits at the very end, after a comment
  // of up to 64KB — so walk backwards looking for its signature.
  let eocd = -1;
  const earliest = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= earliest; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("Not a readable zip archive");

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  const out: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CDH_SIG) break;

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + nameLen)
    );
    offset += 46 + nameLen + extraLen + commentLen;

    // Directory entries and anything the caller doesn't want.
    if (name.endsWith("/") || !filter(name)) continue;

    // The local header repeats the name and extra fields, and its lengths are
    // the authoritative ones for locating the data.
    if (view.getUint32(localOffset, true) !== LFH_SIG) continue;
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const raw = bytes.subarray(start, start + compressedSize);

    if (method === 0) out.push({ name, bytes: raw });
    else if (method === 8) out.push({ name, bytes: await inflateRaw(raw) });
    // Anything else (bzip2, lzma) Google doesn't produce; skip rather than guess.
  }

  return out;
}

/**
 * The calendar's own name, from the file Google names after its id.
 * "Jokes_l693…@group.calendar.google.com.ics" → "Jokes".
 */
export function calendarNameFromFile(name: string): string {
  const base = name.split("/").pop() || name;
  const stem = base.replace(/\.ics$/i, "");
  const at = stem.indexOf("@");
  const head = at === -1 ? stem : stem.slice(0, at);
  // The id is appended after an underscore; strip it when one is there.
  const underscore = head.lastIndexOf("_");
  const label = underscore > 0 ? head.slice(0, underscore) : head;
  return label.trim() || base;
}

// ---------------------------------------------------------------------------
// Writing — the other direction, for files the app hands back (the .xlsx
// export). Entries are stored, not deflated: the files are small, and stored
// is the one method every reader is guaranteed to accept.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A ZIP archive holding these files, uncompressed. */
export function writeZip(files: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const size = file.bytes.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, LFH_SIG, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // names are UTF-8
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, CDH_SIG, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    parts.push(local, file.bytes);
    centrals.push(central);
    offset += local.length + size;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, EOCD_SIG, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  parts.push(...centrals, eocd);
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
