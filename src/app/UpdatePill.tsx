"use client";

import { useEffect, useState } from "react";

// The build this tab is running, baked in at build time.
const CURRENT = process.env.NEXT_PUBLIC_DEPLOY_ID || "dev";

export default function UpdatePill() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    // No version tracking locally — only meaningful on deployed builds.
    if (CURRENT === "dev") return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { id } = await res.json();
        if (!cancelled && id && id !== CURRENT) setUpdateReady(true);
      } catch {
        /* offline or transient — ignore, try again next tick */
      }
    }

    check();
    const interval = setInterval(check, 60_000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] shadow-md rounded-full pl-4 pr-2 py-2">
      <span className="text-sm text-[var(--text)]">A new version is available</span>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors"
      >
        Refresh
      </button>
    </div>
  );
}
