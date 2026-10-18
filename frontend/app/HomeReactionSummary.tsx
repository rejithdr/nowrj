
"use client";

import { useEffect, useState } from "react";

type ReactionSummary = {
  likes: number;
  fires: number;
  liked: boolean;
  fired: boolean;
};

export default function HomeReactionSummary({
  rjId,
}: {
  rjId?: string;
}) {
  const [summary, setSummary] = useState<ReactionSummary | null>(null);

  useEffect(() => {
    if (!rjId) return;

    let cancelled = false;

    async function loadSummary() {
      try {
        const [countsResponse, statusResponse] = await Promise.all([
          fetch(`http://localhost:3000/reactions/rj/${rjId}/counts`, {
            cache: "no-store",
          }),
          fetch(`http://localhost:3000/reactions/rj/${rjId}/status`, {
            credentials: "include",
            cache: "no-store",
          }),
        ]);

        if (!countsResponse.ok) return;

        const counts = await countsResponse.json();

        const status = statusResponse.ok
          ? await statusResponse.json()
          : { liked: false, fired: false };

        if (!cancelled) {
          setSummary({
            likes: counts.likes,
            fires: counts.fires,
            liked: status.liked,
            fired: status.fired,
          });
        }
      } catch {
        // Keep the homepage usable if the API is unavailable.
      }
    }

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, [rjId]);

  if (!rjId || !summary) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-600">
      <span
        className={summary.liked ? "font-semibold text-rose-600" : ""}
        aria-label={`${summary.likes} Likes`}
      >
        ♥ {summary.likes}
      </span>

      <span
        className={summary.fired ? "font-semibold text-orange-600" : ""}
        aria-label={`${summary.fires} Fires`}
      >
        🔥 {summary.fires}
      </span>
    </div>
  );
}
