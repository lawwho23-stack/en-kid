"use client";

import { useEffect } from "react";

/** Register the service worker in production only (never in dev). */
export function SwRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is best-effort; the game works online regardless.
      });
    }
  }, []);
  return null;
}
