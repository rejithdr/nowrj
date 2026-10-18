
"use client";

import { useEffect, useState } from "react";

type Listener = {
  displayName: string;
};

export default function AuthControls() {
  const [listener, setListener] = useState<Listener | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch("http://localhost:3000/auth/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (response.ok) {
  const data = await response.json();
  setListener({ displayName: data.displayName });

  const returnTo = sessionStorage.getItem("nowrjReturnTo");

  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    sessionStorage.removeItem("nowrjReturnTo");
    window.location.replace(returnTo);
    return;
  }

if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
  sessionStorage.removeItem("nowrjReturnTo");
  window.location.replace(returnTo);
  return;
}
        } else {
          setListener(null);
        }
      } catch {
        setListener(null);
      } finally {
        setLoading(false);
      }
    }

    void checkSession();
  }, []);

  async function handleSignOut() {
    setSigningOut(true);

    try {
      const response = await fetch("http://localhost:3000/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        setListener(null);
      }
    } catch {
      // Keep the current state if the backend cannot be reached.
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <span className="text-sm text-zinc-500" aria-live="polite">
        Checking sign-in…
      </span>
    );
  }

  if (listener) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-28 truncate text-sm font-medium text-zinc-700 sm:inline">
          {listener.displayName}
        </span>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="inline-flex min-h-10 items-center rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    );
  }

  return (
    <a
      href="http://localhost:3000/auth/google"
      className="inline-flex min-h-10 items-center rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
    >
      Sign in with Google
    </a>
  );
}
