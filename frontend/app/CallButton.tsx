"use client";

import { Mic, Phone } from "lucide-react";

const API = "http://localhost:3000";

/** A random id kept in this browser so signed-out taps can be counted once per device. */
function deviceId(): string | null {
  try {
    let id = localStorage.getItem("nowrjDevice");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("nowrjDevice", id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Opens the phone dialler and records the tap. Never blocked by sign-in. */
export default function CallButton({ showId, phone }: { showId: string; phone: string }) {
  function record() {
    try {
      void fetch(`${API}/shows/${showId}/call-tap`, {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: deviceId() }),
      }).catch(() => undefined);
    } catch {
      // Recording must never stop the call.
    }
  }

  return (
    <a
      href={`tel:${phone.replace(/\s+/g, "")}`}
      onClick={record}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
    >
      <Mic size={16} aria-hidden="true" />
      <Phone size={16} aria-hidden="true" />
      Call the show
    </a>
  );
}
