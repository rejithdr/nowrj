"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { copyText } from "./copy";
import { pulse } from "./pulse";

const noop = () => () => {};

/**
 * "Share" for a programme, RJ, station, show or offer. WhatsApp and Facebook
 * show NowRJ's picture card for the link. "More…" opens the phone's own share
 * sheet (Instagram, Telegram and the rest). The link carries via=share so we
 * can count people who arrive from a share.
 */
export default function ShareButton({
  path,
  text,
  label = "Share",
  showId,
  programmeId,
  className = "",
}: {
  /** Page to share, e.g. /programme/hello-my-dear-wrong-number */
  path: string;
  /** Message that goes with the link. */
  text: string;
  label?: string;
  showId?: string;
  programmeId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const canNative = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);
  const box = useRef<HTMLDivElement>(null);
  const link = () => `${window.location.origin}${path}${path.includes("?") ? "&" : "?"}via=share`;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const counted = () => pulse("share", { showId, programmeId });

  function openApp(app: "whatsapp" | "facebook") {
    counted();
    setOpen(false);
    const url = link();
    window.open(
      app === "whatsapp" ? `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function native() {
    counted();
    setOpen(false);
    try {
      await navigator.share({ text, url: link() });
    } catch {
      /* closed the sheet */
    }
  }

  async function copy() {
    counted();
    const url = link();
    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      window.prompt("Copy this link:", url);
    }
  }

  const item = "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-zinc-800 hover:bg-orange-50";

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-orange-50"
      >
        <Share2 size={15} aria-hidden="true" /> {label}
      </button>
      {open ? (
        <div role="menu" aria-label="Share" className="absolute left-0 z-20 mt-2 w-52 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg">
          <button type="button" role="menuitem" onClick={() => openApp("whatsapp")} className={item}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366] text-xs font-bold text-white" aria-hidden="true">W</span>
            WhatsApp
          </button>
          <button type="button" role="menuitem" onClick={() => openApp("facebook")} className={item}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1877F2] text-xs font-bold text-white" aria-hidden="true">f</span>
            Facebook
          </button>
          {canNative ? (
            <button type="button" role="menuitem" onClick={() => void native()} className={item}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-zinc-700" aria-hidden="true"><Share2 size={13} /></span>
              More… (Instagram and others)
            </button>
          ) : null}
          <button type="button" role="menuitem" onClick={() => void copy()} className={item}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-zinc-700" aria-hidden="true">{copied ? <Check size={13} /> : <Copy size={13} />}</span>
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
