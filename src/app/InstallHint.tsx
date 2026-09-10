"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "gratitude:install-hint-dismissed";

/* A one-time nudge to actually install the app.
 *
 * iOS gives no beforeinstallprompt and no install button — Add to Home Screen
 * is buried in the share sheet, so a site that never mentions it never gets
 * installed. It also matters for anyone whose home-screen icon predates the
 * manifest: an old bookmark keeps opening in Safari with the address bar, and
 * only re-adding it picks up standalone mode.
 */
export default function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Already installed — `standalone` is the iOS signal, the media query is
    // everyone else's.
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (installed) return;

    const ua = window.navigator.userAgent;
    // Only iOS Safari: Chrome and Firefox on iOS can't add to the home screen,
    // and every other platform has its own install affordance already.
    const iosSafari = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (!iosSafari) return;

    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      /* storage unavailable — showing it once per visit is an acceptable floor */
    }

    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-4 bottom-[calc(var(--tabbar-height)+var(--safe-bottom)+0.75rem)] z-40 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-lg md:hidden">
      <div className="flex-1 text-[13px] leading-relaxed text-[var(--text)]">
        Add Gratitude to your home screen — tap
        {/* Safari's share glyph, drawn rather than borrowed from SF Symbols,
            whose private-use codepoints don't render reliably in web content. */}
        <svg
          className="mx-1 inline-block align-[-0.2em]"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5" />
          <path d="M6 12H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" />
        </svg>
        Share, then <span className="text-[var(--accent)]">Add to Home Screen</span>.
      </div>
      <button
        onClick={() => {
          setShow(false);
          try {
            localStorage.setItem(DISMISSED_KEY, "1");
          } catch {
            /* nothing to do — it just reappears next visit */
          }
        }}
        aria-label="Dismiss"
        className="tap-scale -mr-1 -mt-1 shrink-0 rounded-full p-2 text-[var(--text-muted)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
