"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { api, Card, inputClass, isSignedIn, labelClass, Notice, primaryButton, signInAndReturn } from "../../../lib/ui";

type Target = { name: string; station: string | null; verificationStatus: string; isYou: boolean; alreadyVouched: boolean };

/** A verified RJ confirms they know a new RJ who is waiting for verification. */
export default function VouchPage({ params }: { params: Promise<{ rjId: string }> }) {
  const { rjId } = use(params);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const ok = await isSignedIn();
        setSignedIn(ok);
        if (ok) setTarget(await api<Target>(`/rjs/vouch/${rjId}`));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this page.");
      }
    }
    void load();
  }, [rjId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/rjs/vouch/${rjId}`, { method: "POST", body: JSON.stringify({ note }) });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">
          Now<span className="text-orange-600">RJ</span>
        </Link>
        <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-orange-700">Vouch for an RJ</p>

        {signedIn === false ? (
          <Card>
            <p className="text-zinc-700">Sign in with your RJ account to vouch.</p>
            <button type="button" onClick={signInAndReturn} className={`${primaryButton} mt-4`}>Sign in with Google</button>
          </Card>
        ) : error && !target ? (
          <Notice kind="error" text={error} />
        ) : !target ? (
          <p className="mt-6 text-zinc-600"><LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />Loading…</p>
        ) : done ? (
          <Card>
            <h1 className="text-xl font-bold text-zinc-900">Thank you</h1>
            <p className="mt-2 text-zinc-700">Your vouch for {target.name} has been sent to the NowRJ team.</p>
          </Card>
        ) : target.isYou ? (
          <Notice kind="info" text="This is your own vouch link. Send it to verified RJs who know you." />
        ) : target.alreadyVouched ? (
          <Notice kind="ok" text={`You have already vouched for ${target.name}.`} />
        ) : target.verificationStatus !== "pending" ? (
          <Notice kind="info" text={`${target.name} is not waiting for verification.`} />
        ) : (
          <Card>
            <h1 className="text-2xl font-bold text-zinc-900">Do you know {target.name}?</h1>
            <p className="mt-2 text-zinc-700">
              {target.name}
              {target.station ? ` says they work at ${target.station} and` : ""} has asked you to confirm they are a real RJ. Only vouch for people you know.
            </p>
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 text-sm text-zinc-800">
                <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1" />
                I know {target.name} personally as a radio jockey.
              </label>
              <div>
                <label htmlFor="note" className={labelClass}>How do you know them? (optional)</label>
                <input id="note" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Worked together at Club FM for 3 years" className={inputClass} />
              </div>
              {error ? <Notice kind="error" text={error} /> : null}
              <button type="submit" disabled={!confirm || busy} className={primaryButton}>
                {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
                Vouch for {target.name}
              </button>
            </form>
          </Card>
        )}
        {done ? null : <p className="mt-6 text-xs text-zinc-500"><Check size={12} className="mr-1 inline" aria-hidden="true" />The NowRJ team makes the final decision.</p>}
      </div>
    </main>
  );
}
