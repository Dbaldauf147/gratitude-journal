"use client";

import { useRef } from "react";
import MediaGrid from "./MediaGrid";
import { useDayMedia } from "./useDayMedia";

/**
 * Today's photos and videos. What's added here is what "On This Day" shows a
 * month and a year from now.
 */
export default function TodayMediaCard({ userId, todayKey }: { userId: string; todayKey: string }) {
  const { media, uploading, error, addFiles, remove } = useDayMedia(userId, todayKey);
  const input = useRef<HTMLInputElement>(null);

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
          onChange={async (e) => {
            await addFiles(e.target.files);
            if (input.current) input.current.value = "";
          }}
        />
      </div>
      {!media.length && (
        <p className="text-xs text-[var(--text-muted)]">
          Save a picture or video from today — it&apos;ll show up here a month and a year from now.
        </p>
      )}
      {media.length > 0 && (
        <div className="mt-3">
          <MediaGrid media={media} onDelete={remove} />
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </section>
  );
}
