"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, Mic, X } from "lucide-react";
import { api, Card, isSignedIn, Notice, primaryButton, quietButton, signInAndReturn } from "../../lib/ui";

type Invite = {
  organisationName: string;
  organisationKind: "network" | "standalone";
  place: string;
  emailHint: string;
  status: "sent" | "accepted" | "declined" | "cancelled";
  expired: boolean;
};

/** The link a station, region or head office sends to an RJ it invites. */
export default function RjInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setInvite(await api<Invite>(`/rj-invites/${token}`));
        setSignedIn(await isSignedIn());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this invite.");
      }
    })();
  }, [token]);

  async function answer(accept: boolean) {
    setBusy(true);
    setError("");
    try {
      await api(`/rj-invites/${token}/${accept ? "accept" : "decline"}`, { method: "POST" });
      setDone(accept ? "accepted" : "declined");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not answer the invite.");
    } finally {
      setBusy(false);
    }
  }

  const unusable = invite && (invite.status !== "sent" || invite.expired);
  const needsProfile = error.startsWith("Create your RJ profile");

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">
          Now<span className="text-orange-600">RJ</span>
        </Link>
        {!invite && !error ? <p className="mt-8 text-zinc-600"><LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />Loading invite…</p> : null}
        {invite ? (
          <Card>
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                <Mic size={22} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">RJ invite</p>
                <h1 className="mt-1 text-2xl font-bold text-zinc-900">Join {invite.place}</h1>
                {invite.organisationKind === "network" ? <p className="mt-1 text-zinc-600">{invite.organisationName}</p> : null}
              </div>
            </div>
            {done === "accepted" ? (
              <>
                <Notice kind="ok" text={`You joined ${invite.place}.`} />
                <Link href="/rj/dashboard" className={`${primaryButton} mt-4`}>Open your RJ dashboard</Link>
              </>
            ) : done === "declined" ? (
              <Notice kind="ok" text="Invite declined." />
            ) : unusable ? (
              <Notice kind="error" text={invite.status === "accepted" ? "This invite has already been accepted." : invite.status === "declined" ? "This invite was declined." : invite.status === "cancelled" ? "This invite was cancelled." : "This invite has expired. Ask for a new one."} />
            ) : signedIn === false ? (
              <>
                <p className="mt-4 text-sm text-zinc-600">Sign in with the Google account for {invite.emailHint}.</p>
                <button type="button" onClick={signInAndReturn} className={`${primaryButton} mt-3`}>Sign in with Google</button>
              </>
            ) : signedIn ? (
              <>
                <p className="mt-4 text-sm text-zinc-600">This invite is for {invite.emailHint}.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void answer(true)} disabled={busy} className={primaryButton}>
                    {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} Accept
                  </button>
                  <button type="button" onClick={() => void answer(false)} disabled={busy} className={quietButton}>
                    <X size={14} aria-hidden="true" /> Decline
                  </button>
                </div>
              </>
            ) : null}
            {error ? <Notice kind="error" text={error} /> : null}
            {needsProfile ? (
              <Link href="/rj/register" className={`${primaryButton} mt-3`}>Create your RJ profile</Link>
            ) : null}
          </Card>
        ) : error ? (
          <Notice kind="error" text={error} />
        ) : null}
      </div>
    </main>
  );
}
