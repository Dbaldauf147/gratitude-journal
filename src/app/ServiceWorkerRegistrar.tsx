"use client";

import { useEffect } from "react";

// Same build id the update pill uses. Putting it on the worker's URL means every
// deploy is a byte-different script, which is what makes the browser install a
// new worker and drop the previous version's caches.
const DEPLOY_ID = process.env.NEXT_PUBLIC_DEPLOY_ID || "dev";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // In dev the worker would cache Next's unhashed dev bundles and serve them
    // back after an edit, which looks exactly like a broken hot reload. Tear
    // down anything a previous production visit left behind on this origin.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      return;
    }

    navigator.serviceWorker.register(`/sw.js?v=${DEPLOY_ID}`).catch(() => {
      /* Registration is an enhancement — the app works fine online without it. */
    });
  }, []);

  return null;
}
