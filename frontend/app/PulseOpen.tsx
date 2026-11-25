"use client";

import { useEffect } from "react";
import { pulse } from "./lib/pulse";

/** Counts a visit to NowRJ (once a day per phone; the server ignores repeats). */
export default function PulseOpen() {
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (sessionStorage.getItem("nowrjOpened") === today) return;
      sessionStorage.setItem("nowrjOpened", today);
    } catch {
      /* count anyway */
    }
    pulse("open");
  }, []);
  return null;
}
