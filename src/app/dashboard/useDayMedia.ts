"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  listDayMedia,
  uploadDayMedia,
  deleteDayMedia,
  MAX_MEDIA_BYTES,
  type DayMedia,
} from "@/lib/dailyMedia";

/**
 * One day's photos and videos, plus add/remove. Shared by today's card and the
 * past-entry cards; `enabled` lets a past entry wait until it scrolls into view
 * so a long history doesn't fire a storage listing per entry on load.
 */
export function useDayMedia(userId: string, day: string, enabled = true) {
  const supabase = useMemo(() => createClient(), []);
  const [media, setMedia] = useState<DayMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setMedia(await listDayMedia(supabase, userId, day));
    } catch (e) {
      setError(problem(e));
    }
  }, [supabase, userId, day]);

  useEffect(() => {
    setMedia([]);
    setError("");
    if (enabled) load();
  }, [load, enabled]);

  async function addFiles(files: FileList | null) {
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
      for (const f of ok) await uploadDayMedia(supabase, userId, day, f);
    } catch (e) {
      setError(problem(e));
    }
    setUploading(false);
    load();
  }

  async function remove(item: DayMedia) {
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

  return { media, uploading, error, addFiles, remove, reload: load };
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
