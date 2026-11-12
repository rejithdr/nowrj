"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { copyText } from "./copy";
import { quietButton } from "./ui";

/** An invite link shown in full, with Copy and WhatsApp. Tapping the link selects it for copying by hand. */
export default function InviteLinkBox({ link, whatsappText, label = "Invite link" }: { link: string; whatsappText: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">{label}</p>
      <input
        readOnly
        value={link}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        onClick={(e) => e.currentTarget.select()}
        className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-2 py-1.5 font-mono text-xs text-zinc-800"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={quietButton}
          onClick={async () => {
            setState((await copyText(link)) ? "copied" : "failed");
            setTimeout(() => setState("idle"), 2500);
          }}
        >
          {state === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {state === "copied" ? "Copied" : "Copy link"}
        </button>
        <a className={quietButton} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${whatsappText} ${link}`)}`}>
          <MessageCircle size={14} aria-hidden="true" /> WhatsApp
        </a>
      </div>
      {state === "failed" ? <p className="mt-1 text-xs text-red-700">Your browser blocked copying. Tap the link above, then copy it.</p> : null}
    </div>
  );
}
