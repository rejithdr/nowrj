
"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

export default function LikeButton() {
  const [isLiked, setIsLiked] = useState(false);

  function handleClick() {
    setIsLiked((current) => !current);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isLiked}
      className={
        isLiked
          ? "inline-flex min-h-10 items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors"
          : "inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
      }
    >
      <Heart
        size={16}
        aria-hidden="true"
        fill={isLiked ? "currentColor" : "none"}
      />
      {isLiked ? "Liked" : "Like"}
    </button>
  );
}