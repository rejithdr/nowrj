"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { claimReferralIfAny } from "./lib/referral";

const API = "http://localhost:3000";

type Me = {
  displayName: string | null;
  rj: { name: string; slug: string; verificationStatus: string } | null;
  stations: { id: string; name: string; status: string }[];
  isSuperadmin: boolean;
};

const itemClass = "block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-orange-50 focus-visible:bg-orange-50";

/** Sign-in button, or an account menu listing the dashboards this person can use. */
export default function AuthControls() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch(`${API}/auth/me`, { credentials: "include", cache: "no-store" });
        if (response.ok) {
          setMe(await response.json());
          await claimReferralIfAny();
          const returnTo = sessionStorage.getItem("nowrjReturnTo");
          if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
            sessionStorage.removeItem("nowrjReturnTo");
            window.location.replace(returnTo);
            return;
          }
        } else {
          setMe(null);
        }
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    }
    void checkSession();
  }, []);

  // Close the menu when clicking elsewhere.
  useEffect(() => {
    function close(event: MouseEvent) {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false;
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  function signIn() {
    sessionStorage.setItem("nowrjReturnTo", window.location.pathname);
    window.location.href = `${API}/auth/google`;
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const response = await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
      if (response.ok) window.location.href = "/";
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

  if (!me) {
    return (
      <div className="flex items-center gap-2">
        <a href="/rj/register" className="hidden text-sm font-semibold text-zinc-700 hover:text-orange-700 sm:inline">
          For RJs
        </a>
        <button
          type="button"
          onClick={signIn}
          className="inline-flex min-h-10 items-center rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Sign in
        </button>
      </div>
    );
  }

  const name = me.displayName?.trim().split(/\s+/)[0] || "Account";

  return (
    <details ref={menu} className="relative">
      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-orange-300 hover:bg-orange-50 [&::-webkit-details-marker]:hidden">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-24 truncate">{name}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <nav aria-label="Your account" className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
        {me.rj ? (
          <>
            <a href="/rj/dashboard" className={itemClass}>My RJ dashboard</a>
            {["verified", "legacy"].includes(me.rj.verificationStatus) ? (
              <a href={`/rj/${me.rj.slug}`} className={itemClass}>My public profile</a>
            ) : null}
          </>
        ) : (
          <a href="/rj/register" className={itemClass}>Become an RJ on NowRJ</a>
        )}
        {me.stations.length ? (
          <a href="/station/dashboard" className={itemClass}>
            Station dashboard
            <span className="block truncate text-xs text-zinc-500">
              {me.stations.map((s) => (s.status === "pending" ? `${s.name} (awaiting approval)` : s.name)).join(", ")}
            </span>
          </a>
        ) : null}
        {me.isSuperadmin ? (
          <>
            <p className="mt-1 border-t border-zinc-100 px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Super Admin</p>
            <a href="/admin/insights" className={itemClass}>Platform insights</a>
            <a href="/admin/rjs" className={itemClass}>RJs</a>
            <a href="/admin/stations" className={itemClass}>Stations &amp; claims</a>
          </>
        ) : null}
        <div className="mt-1 border-t border-zinc-100 pt-1">
          <button type="button" onClick={() => void handleSignOut()} disabled={signingOut} className={`${itemClass} w-full text-left disabled:opacity-60`}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </nav>
    </details>
  );
}
