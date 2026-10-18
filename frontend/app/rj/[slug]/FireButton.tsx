
"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

type FireButtonProps = {
  rjId?: string;
};

export default function FireButton({ rjId }: FireButtonProps) {
  const [isFired, setIsFired] = useState(false);
const [isSignedIn, setIsSignedIn] = useState(false);
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);
const [message, setMessage] = useState("");

useEffect(() => {
  if (!rjId) {
    setIsLoading(false);
    return;
  }

  async function loadFireStatus() {
    try {
      const authResponse = await fetch(
        "http://localhost:3000/auth/me",
        { credentials: "include" },
      );

      if (!authResponse.ok) {
        setIsSignedIn(false);
        return;
      }

      setIsSignedIn(true);

      const statusResponse = await fetch(
        `http://localhost:3000/reactions/rj/${rjId}/status`,
        { credentials: "include" },
      );

      if (!statusResponse.ok) {
        setMessage("Could not load Fire status.");
        return;
      }

      const data = await statusResponse.json();
      setIsFired(data.fired);
    } catch {
      setMessage("Could not connect to NowRJ.");
    } finally {
      setIsLoading(false);
    }
  }

  void loadFireStatus();
}, [rjId]);

 async function handleClick() {
  setMessage("");

  if (!rjId) {
    setIsFired((current) => !current);
    return;
  }

  if (!isSignedIn) {
    sessionStorage.setItem("nowrjReturnTo", window.location.pathname);
window.location.href = "http://localhost:3000/auth/google";
    return;
  }

  setIsSaving(true);

  try {
    const response = await fetch(
      `http://localhost:3000/reactions/rj/${rjId}?type=fire`,
      {
        method: isFired ? "DELETE" : "POST",
        credentials: "include",
      },
    );

    if (response.status === 401) {
  sessionStorage.setItem("nowrjReturnTo", window.location.pathname);
  window.location.href = "http://localhost:3000/auth/google";
  return;
}

    if (!response.ok) {
      setMessage("Could not update Fire. Please try again.");
      return;
    }

    const data = await response.json();
    setIsFired(data.active);
  } catch {
    setMessage("Could not connect to NowRJ. Please try again.");
  } finally {
    setIsSaving(false);
  }
}

  return (
  <div>
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading || isSaving}
      aria-pressed={isFired}
      className={
        isFired
          ? "inline-flex min-h-10 items-center gap-2 rounded-full border border-orange-300 bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-800 transition-colors disabled:cursor-wait disabled:opacity-60"
          : "inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60"
      }
    >
      <Flame size={16} aria-hidden="true" />
      {isLoading
        ? "Loading..."
        : isSaving
          ? "Saving..."
          : isFired
            ? "On Fire"
            : "Fire"}
    </button>

    {message && (
      <p className="mt-2 text-sm text-red-600" role="status">
        {message}
      </p>
    )}
  </div>
);
}