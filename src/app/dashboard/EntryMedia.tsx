"use client";

import { useEffect, useRef, useState } from "react";
import MediaGrid from "./MediaGrid";
import { useDayMedia } from "./useDayMedia";

/**
 * The photos and videos saved for a past entry's day. Read-only until the
 * entry is being edited, when it grows an add button and per-tile remove —
 * the same rule MediaGrid follows for throwbacks, so nothing is deleted by a
 * stray tap while scrolling. Loads only once the card is near the viewport.
 */
export default function EntryMedia({
  userId,
  day,
  editing,
}: {
  userId: string;
  day: string;
  editing: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  // Opening the editor counts as seen, so closing it doesn't drop what loaded.
  if (editing && !visible) setVisible(true);
  const { media, uploading, error, addFiles, remove } = useDayMedia(userId, day, visible || editing);

  useEffect(() => {
    const el = box.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (seen) => seen.some((s) => s.isIntersecting) && setVisible(true),
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={box}>
      {media.length > 0 && (
        <div className="mt-4">
          <MediaGrid media={media} onDelete={editing ? remove : undefined} />
        </div>
      )}
      {editing && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={uploading}
            className="px-4 py-1.5 rounded-full border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors disabled:opacity-60"
          >
            {uploading ? "Uploading…" : media.length ? "Add another photo or video" : "Add photo or video"}
          </button>
          <input
            ref={input}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              await addFiles(e.target.files);
              if (input.current) input.current.value = "";
            }}
          />
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
