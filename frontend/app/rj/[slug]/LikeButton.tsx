
"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

type LikeButtonProps = {
  rjId?: string;
};

export default function LikeButton({ rjId }: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(false);
const [isSignedIn, setIsSignedIn] = useState(false);
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);
const [message, setMessage] = useState("");

useEffect(() => {
  if (!rjId) {
    setIsLoading(false);
    return;
  }

  async function loadLikeStatus() {
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
        setMessage("Could not load Like status.");
        return;
      }

      const data = await statusResponse.json();
      setIsLiked(data.liked);
    } catch {
      setMessage("Could not connect to NowRJ.");
    } finally {
      setIsLoading(false);
    }
  }

  void loadLikeStatus();
}, [rjId]);

  async function handleClick() {
  setMessage("");

  if (!rjId) {
    setIsLiked((current) => !current);
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
      `http://localhost:3000/reactions/rj/${rjId}?type=like`,
      {
        method: isLiked ? "DELETE" : "POST",
        credentials: "include",
      },
    );

    if (response.status === 401) {
      window.location.href = "http://localhost:3000/auth/google";
      return;
    }

    if (!response.ok) {
      setMessage("Could not update Like. Please try again.");
      return;
    }

    const data = await response.json();
    setIsLiked(data.active);
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
      aria-pressed={isLiked}
      className={
        isLiked
          ? "inline-flex min-h-10 items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors disabled:cursor-wait disabled:opacity-60"
          : "inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60"
      }
    >
      <Heart
        size={16}
        aria-hidden="true"
        fill={isLiked ? "currentColor" : "none"}
      />
      {isLoading
        ? "Loading..."
        : isSaving
          ? "Saving..."
          : isLiked
            ? "Liked"
            : "Like"}
    </button>

    {message && (
      <p className="mt-2 text-sm text-red-600" role="status">
        {message}
      </p>
    )}
  </div>
);
}