"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Trash2 } from "lucide-react";
import AuthControls from "../AuthControls";
import { api, Card, inputClass, labelClass, Notice, primaryButton, signInAndReturn } from "../lib/ui";

type Me = { displayName: string | null; rj: { name: string } | null; stations: { name: string }[] };

/** The name RJs and stations see, for example on song requests. */
function NameCard({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await api<{ displayName: string }>("/auth/me", { method: "PATCH", body: JSON.stringify({ displayName: name }) });
      setName(result.displayName);
      setSaved(result.displayName);
      setMessage({ kind: "ok", text: "Name saved." });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Could not save your name." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Your name">
      <form onSubmit={save}>
        <label htmlFor="display-name" className={`${labelClass} mt-3`}>Name shown to RJs and stations</label>
        <input id="display-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
        <p className="mt-1.5 text-xs text-zinc-500">Appears with your song requests. A first name or nickname is fine.</p>
        {message ? <div className="mt-3"><Notice kind={message.kind} text={message.text} /></div> : null}
        <button type="submit" className={`${primaryButton} mt-3`} disabled={busy || name.trim() === saved}>
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
          Save name
        </button>
      </form>
    </Card>
  );
}

/** Account settings: your name, and deleting the account. */
export default function AccountPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null));
  }, []);

  async function deleteAccount() {
    setBusy(true);
    setError("");
    try {
      await api("/auth/me", { method: "DELETE", body: JSON.stringify({ confirm }) });
      setDeleted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">
            Now<span className="text-orange-600">RJ</span>
          </Link>
          {deleted ? null : <AuthControls />}
        </header>

        <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-zinc-900">Account settings</h1>

        <div className="mt-6">
          {deleted ? (
            <Card>
              <Notice kind="ok" text="Your account has been deleted and you have been signed out." />
              <p className="mt-4 text-sm text-zinc-600">
                You can still browse NowRJ. If you sign in again later, a new, empty account is created.
              </p>
              <a href="/" className="mt-4 inline-block font-semibold text-orange-700 underline">Go to the homepage</a>
            </Card>
          ) : me === undefined ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : me === null ? (
            <Card>
              <p className="text-zinc-700">Sign in to manage your account.</p>
              <button type="button" onClick={signInAndReturn} className="mt-4 rounded-full bg-orange-600 px-5 py-2.5 font-semibold text-white hover:bg-orange-700">
                Sign in
              </button>
            </Card>
          ) : (
            <>
            <NameCard initial={me.displayName ?? ""} />
            <Card title="Delete my account">
              <p className="text-sm leading-6 text-zinc-700">
                This permanently erases your name, email, photo, follows, Likes and Fires, and song requests, and signs you out
                everywhere. Totals on shows stay but no longer identify you. It cannot be undone.
              </p>
              {me.rj ? (
                <p className="mt-3 text-sm leading-6 text-zinc-700">
                  <strong>Your RJ profile ({me.rj.name})</strong> will be renamed &ldquo;Former RJ&rdquo; and hidden. Programmes
                  owned by a station stay with the station; programmes you own alone are hidden.
                </p>
              ) : null}
              {me.stations.length ? (
                <p className="mt-3 text-sm leading-6 text-zinc-700">
                  You will stop managing {me.stations.map((s) => s.name).join(", ")}. The station itself stays on NowRJ.
                </p>
              ) : null}
              <p className="mt-3 text-sm text-zinc-600">
                Details are in our <a href="/privacy" className="font-medium text-orange-700 underline">Privacy Policy</a>.
              </p>
              <label className={`${labelClass} mt-5`} htmlFor="confirm">Type DELETE to confirm</label>
              <input id="confirm" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
              {error ? <div className="mt-3"><Notice kind="error" text={error} /></div> : null}
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={confirm !== "DELETE" || busy}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-red-600 px-5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}
                Delete my account
              </button>
            </Card>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
