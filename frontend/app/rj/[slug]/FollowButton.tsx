
"use client";

import { useState } from "react";

export default function FollowButton() {
  const [isFollowing, setIsFollowing] = useState(false);

  function handleClick() {
    setIsFollowing((current) => !current);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isFollowing}
      className={
        isFollowing
          ? "min-h-11 rounded-full border border-orange-600 bg-orange-50 px-6 py-2 font-semibold text-orange-700 transition-colors"
          : "min-h-11 rounded-full bg-orange-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-orange-700"
      }
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}