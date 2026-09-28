"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  listDayMedia,
  uploadDayMedia,
  deleteDayMedia,
  MAX_MEDIA_BYTES,
  type DayMedia,
} from "@/lib/dailyMedia";
import MediaGrid from "./MediaGrid";

/**
 * Today's photos and videos. What's added here is what "On This Day" shows a
 * month and a year from now.
 */
export default function TodayMediaCard({ userId, todayKey }: { userId: string; todayKey: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [media, setMedia] = useState<DayMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setMedia(await listDayMedia(supabase, userId, todayKey));
    } catch (e) {
      setError(problem(e));
    }
  }, [supabase, userId, todayKey]);

  useEffect(() => {
    setMedia([]);
    setError("");
    load();
  }, [load]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const picked = Array.from(files);
    const tooBig = picked.filter((f) => f.size > MAX_MEDIA_BYTES);
    const ok = picked.filter((f) => f.size <= MAX_MEDIA_BYTES);
    if (tooBig.length) {
      setError(
        `${tooBig.length === 1 ? "That file is" : `${tooBig.length} files are`} over 50 MB — try a shorter clip.`
      );
    }
    if (!ok.length) return;

    setUploading(true);
    try {
      for (const f of ok) await uploadDayMedia(supabase, userId, todayKey, f);
    } catch (e) {
      setError(problem(e));
    }
    setUploading(false);
    if (input.current) input.current.value = "";
    load();
  }

  async function handleDelete(item: DayMedia) {
    if (!confirm(item.kind === "video" ? "Remove this video?" : "Remove this photo?")) return;
    const before = media;
    setMedia((m) => m.filter((x) => x.path !== item.path));
    try {
      await deleteDayMedia(supabase, item.path);
    } catch (e) {
      setMedia(before);
      setError(problem(e));
    }
  }

  return (
    <section className="bg-[var(--surface)] rounded-2xl p-5 shadow-sm border border-[var(--border)]">
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase">
          Today&apos;s Moment
        </p>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading}
          className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-60"
        >
          {uploading ? "Uploading…" : media.length ? "Add another" : "Add photo or video"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {!media.length && (
        <p className="text-xs text-[var(--text-muted)]">
          Save a picture or video from today — it&apos;ll show up here a month and a year from now.
        </p>
      )}
      {media.length > 0 && (
        <div className="mt-3">
          <MediaGrid media={media} onDelete={handleDelete} />
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </section>
  );
}

// Supabase throws plain objects, so String(err) would read "[object Object]".
function problem(err: unknown) {
  const msg = (err as { message?: string })?.message || "";
  if (/exceeded the maximum allowed size|payload too large/i.test(msg)) {
    return "That file is too big to save — try a shorter clip.";
  }
  if (/mime type/i.test(msg)) return "Only photos and videos can be saved here.";
  return msg || "Something went wrong. Try again.";
}
