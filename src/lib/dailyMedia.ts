/**
 * The day's photos and videos, kept in the private `daily-media` bucket.
 *
 * Files live at `<user id>/<YYYY-MM-DD>/<name>`, where the date is the
 * uploader's local day. That makes "what did I add on this day" a folder
 * listing, so there's no table to drift out of step with the files. Storage
 * policies check the first path segment against the caller, which is the whole
 * access model — see scripts/create-daily-media-and-dad-jokes.sql.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const MEDIA_BUCKET = "daily-media";

/** Mirrors the bucket's file_size_limit, so a big video fails before upload. */
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

export interface DayMedia {
  path: string;
  kind: "image" | "video";
  url: string;
}

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp)$/i;

/** Every photo/video for one local day, oldest first, with short-lived URLs. */
export async function listDayMedia(
  supabase: SupabaseClient,
  userId: string,
  day: string
): Promise<DayMedia[]> {
  const folder = `${userId}/${day}`;
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list(folder, { sortBy: { column: "created_at", order: "asc" } });
  if (error) throw error;

  // Supabase drops a placeholder into folders created from the dashboard.
  const files = (data || []).filter((f) => f.id && !f.name.startsWith("."));
  if (!files.length) return [];

  const paths = files.map((f) => `${folder}/${f.name}`);
  const { data: signed, error: signError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(paths, 60 * 60);
  if (signError) throw signError;

  return files.flatMap((f, i) => {
    const url = signed?.[i]?.signedUrl;
    if (!url) return [];
    const mime = (f.metadata?.mimetype as string | undefined) || "";
    const kind = mime.startsWith("video/") || VIDEO_EXT.test(f.name) ? "video" : "image";
    return [{ path: paths[i], kind, url }];
  });
}

export async function uploadDayMedia(
  supabase: SupabaseClient,
  userId: string,
  day: string,
  file: File
) {
  const ext =
    (file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] || file.type.split("/")[1] || "bin").toLowerCase();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(`${userId}/${day}/${name}`, file, { contentType: file.type || undefined });
  if (error) throw error;
}

export async function deleteDayMedia(supabase: SupabaseClient, path: string) {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) throw error;
}

/** The local YYYY-MM-DD for `months`/`years` before `todayKey`. */
export function dayAgo(todayKey: string, { months = 0, years = 0 }) {
  const [y, m, d] = todayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setFullYear(date.getFullYear() - years, date.getMonth() - months);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
