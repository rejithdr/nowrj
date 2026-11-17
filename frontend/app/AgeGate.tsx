"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { api } from "./lib/ui";

/**
 * Asked once after signing in: NowRJ accounts are for people 18 and over.
 * Until answered, the account can look around but not change anything.
 */
export default function AgeGate() {
  const [ask, setAsk] = useState(false);
  const [under, setUnder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ adultConfirmed?: boolean }>("/auth/me")
      .then((me) => setAsk(me.adultConfirmed === false))
      .catch(() => setAsk(false));
  }, []);

  async function answer(adult: boolean) {
    setBusy(true);
    setError("");
    try {
      await api("/auth/me/age", { method: "POST", body: JSON.stringify({ adult }) });
      if (adult) {
        setAsk(false);
        window.location.reload();
      } else {
        window.location.href = "/";
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (!ask) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="age-title" className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {under ? (
          <>
            <h2 id="age-title" className="text-xl font-bold text-zinc-900">We&apos;ll remove your account</h2>
            <p className="mt-2 text-sm text-zinc-700">
              NowRJ accounts are only for people 18 and over, so we&apos;ll delete your account and its details and sign you out.
            </p>
            <p className="mt-2 text-sm text-zinc-700">
              You can still listen, see what&apos;s on and call your favourite shows without an account.
            </p>
            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={busy} onClick={() => void answer(false)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 font-semibold text-white disabled:opacity-60">
                {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null} Remove my account
              </button>
              <button type="button" disabled={busy} onClick={() => setUnder(false)} className="min-h-12 rounded-full border border-zinc-300 px-5 font-semibold text-zinc-800">
                Go back
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="age-title" className="text-xl font-bold text-zinc-900">Are you 18 or older?</h2>
            <p className="mt-2 text-sm text-zinc-700">
              NowRJ accounts are for people 18 and over. We ask once, and then you&apos;re all set.
            </p>
            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" disabled={busy} onClick={() => void answer(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-orange-600 px-5 font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
                {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null} Yes, I&apos;m 18 or older
              </button>
              <button type="button" disabled={busy} onClick={() => setUnder(true)} className="min-h-12 rounded-full border border-zinc-300 px-5 font-semibold text-zinc-800">
                No, I&apos;m under 18
              </button>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              See our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
