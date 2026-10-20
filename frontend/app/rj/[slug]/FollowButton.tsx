
"use client";
import { API_URL } from "../../lib/config";

import { useEffect, useState } from "react";

type FollowButtonProps = {
  rjId?: string;
};

export default function FollowButton({ rjId }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!rjId) {
      setIsLoading(false);
      return;
    }

    async function loadFollowStatus() {
      try {
        const authResponse = await fetch(
          `${API_URL}/auth/me`,
          { credentials: "include" },
        );

        if (!authResponse.ok) {
          setIsSignedIn(false);
          return;
        }

        setIsSignedIn(true);

        const statusResponse = await fetch(
          `${API_URL}/follows/${rjId}/status`,
          { credentials: "include" },
        );

        if (!statusResponse.ok) {
          setMessage("Could not load follow status.");
          return;
        }

        const data = await statusResponse.json();
        setIsFollowing(data.following);
      } catch {
        setMessage("Could not connect to NowRJ.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadFollowStatus();
  }, [rjId]);

  async function handleClick() {
    setMessage("");

    // Keep the existing demo behavior for profiles without database IDs.
    if (!rjId) {
      setIsFollowing((current) => !current);
      return;
    }

    if (!isSignedIn) {
      window.location.href = `${API_URL}/auth/google`;
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `${API_URL}/follows/${rjId}`,
        {
          method: isFollowing ? "DELETE" : "POST",
          credentials: "include",
        },
      );

      if (response.status === 401) {
        window.location.href = `${API_URL}/auth/google`;
        return;
      }

      if (!response.ok) {
        setMessage("Could not update follow status. Please try again.");
        return;
      }

      const data = await response.json();
      setIsFollowing(data.following);
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
        aria-pressed={isFollowing}
        className={
          isFollowing
            ? "min-h-11 rounded-full border border-orange-600 bg-orange-50 px-6 py-2 font-semibold text-orange-700 transition-colors disabled:cursor-wait disabled:opacity-60"
            : "min-h-11 rounded-full bg-orange-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60"
        }
      >
        {isLoading
          ? "Loading..."
          : isSaving
            ? "Saving..."
            : isFollowing
              ? "Following"
              : "Follow"}
      </button>

      {message && (
        <p className="mt-2 text-sm text-red-600" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
