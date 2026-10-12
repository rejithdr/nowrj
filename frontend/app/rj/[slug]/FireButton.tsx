
"use client";

import { useState } from "react";
import { Flame } from "lucide-react";

export default function FireButton() {
  const [isFired, setIsFired] = useState(false);

  function handleClick() {
    setIsFired((current) => !current);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isFired}
      className={
        isFired
          ? "inline-flex min-h-10 items-center gap-2 rounded-full border border-orange-300 bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-800 transition-colors"
          : "inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
      }
    >
      <Flame size={16} aria-hidden="true" />
      {isFired ? "Fired" : "Fire"}
    </button>
  );
}