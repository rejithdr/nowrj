"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Send } from "lucide-react";
import AuthControls from "../../AuthControls";
import ConsentBox from "../../lib/consent-box";
import { CONSENT_TEXT, CreativeCard, type Creative } from "../../lib/station-ads";
import { api, Card, dangerButton, isSignedIn, Notice, primaryButton, quietButton, signInAndReturn, StatusPill } from "../../lib/ui";

type Business = {
  id: string;
  businessName: string;
  contactName: string;
  consent: { status: keyof typeof CONSENT_TEXT; kind: string | null; since: string | null; signedName: string | null };
  stations: { id: string; name: string; slug: string; status: string }[];
  creatives: (Creative & { stationName: string })[];
};
type Data = { consentVersion: string; consentPoints: string[]; businesses: Business[] };

/** What a business sees: its stations, consent and ad library. */
export default function AdvertiserDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [signedIn, setSignedIn] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => setData(await api<Data>("/advertiser/me")), []);

  useEffect(() => {
    (async () => {
      if (!(await isSignedIn())) return setSignedIn(false);
      await load().catch((e) => setError(e instanceof Error ? e.message : "Could not load your dashboard."));
    })();
  }, [load]);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 hover:underline">
            <ArrowLeft size={16} aria-hidden="true" /> Back to NowRJ
          </Link>
          <AuthControls />
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-orange-700">Advertiser dashboard</p>
        {!signedIn ? (
          <Card>
            <p className="text-zinc-700">Sign in with the Google account your station invited.</p>
            <button type="button" onClick={signInAndReturn} className={`${primaryButton} mt-4`}>Sign in with Google</button>
          </Card>
        ) : error ? (
          <Notice kind="error" text={error} />
        ) : !data ? (
          <p className="mt-6 text-zinc-600"><LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />Loading…</p>
        ) : data.businesses.length === 0 ? (
          <Card>
            <h1 className="text-xl font-bold text-zinc-900">No business linked yet</h1>
            <p className="mt-2 text-zinc-600">Open the invite link your radio station sent you.</p>
          </Card>
        ) : (
          <>
            {message ? <Notice kind="ok" text={message} /> : null}
            {data.businesses.map((b) => (
              <BusinessPanel key={b.id} business={b} data={data} onChanged={load} onMessage={setMessage} />
            ))}
          </>
        )}
      </div>
    </main>
  );
}

function BusinessPanel({ business: b, data, onChanged, onMessage }: { business: Business; data: Data; onChanged: () => Promise<void>; onMessage: (m: string) => void }) {
  const [consent, setConsent] = useState({ agree: false, signedName: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      onMessage(done);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-zinc-900">{b.businessName}</h1>
        <StatusPill text={CONSENT_TEXT[b.consent.status].text} tone={CONSENT_TEXT[b.consent.status].tone} />
      </div>
      <p className="mt-1 text-sm text-zinc-600">With {b.stations.map((s) => s.name).join(", ")}</p>
      {error ? <Notice kind="error" text={error} /> : null}

      {b.consent.status === "valid" ? (
        <p className="mt-2 text-sm text-zinc-600">
          Consent given{b.consent.signedName ? ` by ${b.consent.signedName}` : b.consent.kind === "scan" ? " on a signed form" : ""}
          {b.consent.since ? ` on ${new Date(b.consent.since).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}.{" "}
          <button
            type="button"
            disabled={busy}
            className="font-semibold text-red-700 hover:underline"
            onClick={() => window.confirm("Withdraw consent? Your ads stop until you give consent again.") && void act(() => api(`/advertiser/${b.id}/consent/withdraw`, { method: "POST" }), "Consent withdrawn. Your ads will not run.")}
          >
            Withdraw consent
          </button>
        </p>
      ) : b.consent.status === "pending_check" ? (
        <Notice kind="info" text="Your signed form is with the NowRJ team for checking." />
      ) : (
        <>
          <ConsentBox version={data.consentVersion} points={data.consentPoints} onChange={setConsent} />
          <button
            type="button"
            disabled={busy || !consent.agree || consent.signedName.trim().length < 2}
            className={`${primaryButton} mt-3`}
            onClick={() => void act(() => api(`/advertiser/${b.id}/consent`, { method: "POST", body: JSON.stringify(consent) }), "Consent given. Thank you.")}
          >
            Give consent
          </button>
        </>
      )}

      <h2 className="mt-6 text-lg font-bold text-zinc-900">Your ad library</h2>
      <p className="mt-1 text-sm text-zinc-600">The station prepares these. If something should change, send them a suggestion.</p>
      {b.creatives.length === 0 ? <p className="mt-3 text-sm text-zinc-600">Nothing yet.</p> : null}
      <ul className="mt-3 grid gap-4 sm:grid-cols-2">
        {b.creatives.map((c) => (
          <li key={c.id}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{c.stationName}</p>
            <CreativeCard creative={c} />
            {c.suggestions.map((s) => (
              <p key={s.id} className="mt-2 text-sm text-zinc-700">
                You suggested: {s.text} <span className={s.status === "done" ? "text-green-700" : "text-amber-700"}>· {s.status === "done" ? "Done" : "Waiting"}</span>
              </p>
            ))}
            <SuggestForm creativeId={c.id} onSent={async () => { onMessage("Suggestion sent to the station."); await onChanged(); }} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SuggestForm({ creativeId, onSent }: { creativeId: string; onSent: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/advertiser/creatives/${creativeId}/suggestions`, { method: "POST", body: JSON.stringify({ text }) });
      setText("");
      setOpen(false);
      await onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-2 text-sm font-semibold text-orange-700 hover:underline">Suggest a change</button>;
  return (
    <form onSubmit={submit} className="mt-2 space-y-2">
      <textarea required maxLength={500} rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label="Your suggestion" className="w-full rounded-xl border border-zinc-300 p-2 text-sm" />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}><Send size={14} aria-hidden="true" /> Send</button>
        <button type="button" onClick={() => setOpen(false)} className={quietButton}>Cancel</button>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
