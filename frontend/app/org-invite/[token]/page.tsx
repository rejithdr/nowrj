"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Check, LoaderCircle } from "lucide-react";
import { api, Card, isSignedIn, Notice, primaryButton, signInAndReturn } from "../../lib/ui";

type Invite = {
  organisationName: string;
  organisationKind: "network" | "standalone";
  place: string;
  designationName: string;
  emailHint: string;
  status: "sent" | "accepted" | "cancelled";
  expired: boolean;
};

/** The link an organisation sends to someone it invites as staff. */
export default function OrgInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setInvite(await api<Invite>(`/org-invites/${token}`));
        setSignedIn(await isSignedIn());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this invite.");
      }
    }
    void load();
  }, [token]);

  async function accept() {
    setBusy(true);
    setError("");
    try {
      await api(`/org-invites/${token}/accept`, { method: "POST" });
      setJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept the invite.");
    } finally {
      setBusy(false);
    }
  }

  const unusable = invite && (invite.status !== "sent" || invite.expired);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">
          Now<span className="text-orange-600">RJ</span>
        </Link>

        {!invite && !error ? (
          <p className="mt-8 text-zinc-600"><LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />Loading invite…</p>
        ) : null}

        {invite ? (
          <Card>
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                <Building2 size={22} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">Staff invite</p>
                <h1 className="mt-1 text-2xl font-bold text-zinc-900">Join {invite.organisationName}</h1>
                <p className="mt-1 text-zinc-600">
                  as <span className="font-semibold text-zinc-800">{invite.designationName}</span>
                  {invite.organisationKind === "network" ? <> · {invite.place}</> : null}
                </p>
              </div>
            </div>

            {joined ? (
              <>
                <Notice kind="ok" text={`You are now on the staff of ${invite.organisationName}.`} />
                <Link href="/station/dashboard" className={`${primaryButton} mt-4`}>Open the station dashboard</Link>
              </>
            ) : unusable ? (
              <Notice
                kind="error"
                text={invite.status === "accepted" ? "This invite has already been used." : invite.status === "cancelled" ? "This invite was cancelled." : "This invite has expired. Ask for a new one."}
              />
            ) : signedIn === false ? (
              <>
                <p className="mt-4 text-sm text-zinc-600">Sign in with the Google account for {invite.emailHint}.</p>
                <button type="button" onClick={signInAndReturn} className={`${primaryButton} mt-3`}>Sign in with Google</button>
              </>
            ) : signedIn ? (
              <>
                <p className="mt-4 text-sm text-zinc-600">This invite is for {invite.emailHint}.</p>
                <button type="button" onClick={() => void accept()} disabled={busy} className={`${primaryButton} mt-3`}>
                  {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                  Accept and join
                </button>
              </>
            ) : null}
            {error ? <Notice kind="error" text={error} /> : null}
          </Card>
        ) : error ? (
          <Notice kind="error" text={error} />
        ) : null}
      </div>
    </main>
  );
}
