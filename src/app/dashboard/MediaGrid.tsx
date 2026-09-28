"use client";

import { useEffect, useState } from "react";
import type { DayMedia } from "@/lib/dailyMedia";

/**
 * Thumbnails for one day's photos and videos. Tapping a photo opens it full
 * screen; videos play in place. `onDelete` adds a remove button to each tile —
 * only today's card passes it, so a throwback can't be deleted by accident.
 */
export default function MediaGrid({
  media,
  onDelete,
}: {
  media: DayMedia[];
  onDelete?: (item: DayMedia) => void;
}) {
  const [open, setOpen] = useState<DayMedia | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  if (!media.length) return null;

  return (
    <>
      <div className={`grid gap-2 ${media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {media.map((m) => (
          <div key={m.path} className="relative rounded-xl overflow-hidden bg-black/5">
            {m.kind === "video" ? (
              // #t=0.1 makes iOS paint a first frame instead of a blank box.
              <video
                src={`${m.url}#t=0.1`}
                controls
                playsInline
                preload="metadata"
                className="w-full max-h-72 object-contain bg-black"
              />
            ) : (
              <button type="button" onClick={() => setOpen(m)} className="block w-full" aria-label="View photo">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URLs; next/image can't optimise them */}
                <img
                  src={m.url}
                  alt=""
                  loading="lazy"
                  className={`w-full object-cover ${media.length === 1 ? "max-h-72" : "aspect-square"}`}
                />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(m)}
                aria-label="Remove"
                title="Remove"
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/55 text-white text-base leading-none flex items-center justify-center hover:bg-black/75"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.url} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  );
}
