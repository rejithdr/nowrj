"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, Megaphone } from "lucide-react";
import ConsentBox from "../../lib/consent-box";
import { api, Card, isSignedIn, Notice, primaryButton, signInAndReturn } from "../../lib/ui";

type Invite = {
  businessName: string;
  stationName: string;
  emailHint: string;
  status: "sent" | "accepted" | "cancelled";
  expired: boolean;
  consentNeeded: boolean;
  consentVersion: string;
  consentPoints: string[];
};

/** The link a station sends to a business it invites to advertise. */
export default function AdvertiserInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [consent, setConsent] = useState({ agree: false, signedName: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setInvite(await api<Invite>(`/advertiser-invites/${token}`));
        setSignedIn(await isSignedIn());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this invite.");
      }
    })();
  }, [token]);

  async function accept() {
    setBusy(true);
    setError("");
    try {
      await api(`/advertiser-invites/${token}/accept`, { method: "POST", body: JSON.stringify(consent) });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept the invite.");
    } finally {
      setBusy(false);
    }
  }

  const unusable = invite && (invite.status !== "sent" || invite.expired);
  const ready = !invite?.consentNeeded || (consent.agree && consent.signedName.trim().length > 1);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">Now<span className="text-orange-600">RJ</span></Link>
        {!invite && !error ? <p className="mt-8 text-zinc-600"><LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />Loading invite…</p> : null}
        {invite ? (
          <Card>
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700"><Megaphone size={22} aria-hidden="true" /></span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">Advertiser invite</p>
                <h1 className="mt-1 text-2xl font-bold text-zinc-900">{invite.businessName}</h1>
                <p className="mt-1 text-zinc-600">{invite.stationName} invites you to advertise on NowRJ.</p>
              </div>
            </div>
            {done ? (
              <>
                <Notice kind="ok" text="You're set up. The station prepares your ads; you can see them and suggest changes on your dashboard." />
                <Link href="/advertiser/dashboard" className={`${primaryButton} mt-4`}>Open advertiser dashboard</Link>
              </>
            ) : unusable ? (
              <Notice kind="error" text={invite.status === "accepted" ? "This invite has already been used." : invite.status === "cancelled" ? "This invite was replaced or cancelled. Ask the station for the latest link." : "This invite has expired. Ask the station for a new one."} />
            ) : signedIn === false ? (
              <>
                <p className="mt-4 text-sm text-zinc-600">Sign in with the Google account for {invite.emailHint}.</p>
                <button type="button" onClick={signInAndReturn} className={`${primaryButton} mt-3`}>Sign in with Google</button>
              </>
            ) : signedIn ? (
              <>
                <p className="mt-4 text-sm text-zinc-600">This invite is for {invite.emailHint}.</p>
                {invite.consentNeeded ? <ConsentBox version={invite.consentVersion} points={invite.consentPoints} onChange={setConsent} /> : null}
                <button type="button" onClick={() => void accept()} disabled={busy || !ready} className={`${primaryButton} mt-4`}>
                  {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                  {invite.consentNeeded ? "Agree and continue" : "Accept invite"}
                </button>
              </>
            ) : null}
            {error ? <Notice kind="error" text={error} /> : null}
          </Card>
        ) : error ? <Notice kind="error" text={error} /> : null}
      </div>
    </main>
  );
}
