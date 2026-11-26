"use client";

import { useEffect } from "react";
import { pulse } from "./pulse";

/** Counts people who arrive from a link someone shared (?via=share), then tidies the address. */
export default function ShareArrival() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("via") !== "share") return;
      pulse("share_open", { path: url.pathname });
      url.searchParams.delete("via");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } catch {
      /* analytics only */
    }
  }, []);
  return null;
}
