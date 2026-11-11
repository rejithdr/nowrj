"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, LoaderCircle, MessageCircle, Plus, UserMinus, X } from "lucide-react";
import { api, Card, dangerButton, inputClass, labelClass, Notice, primaryButton, quietButton } from "./ui";

type Place = { id: string; name: string; kind: "region" | "station"; parentId: string | null };
type RjRow = { id: string; name: string; slug: string; photoUrl: string | null; unitId: string | null; joinedOn: string; editable: boolean };
type InviteRow = { id: string; email: string; unitId: string | null; token: string; expiresAt: string; expired: boolean; editable: boolean };
type Data = {
  organisation: { id: string; name: string; kind: "network" | "standalone" };
  canEdit: boolean;
  ownPlace: string | null;
  superadmin: boolean;
  places: Place[];
  rjs: RjRow[];
  invites: InviteRow[];
};

const link = (token: string) => `${typeof window === "undefined" ? "" : window.location.origin}/rj-invite/${token}`;

/** RJs at each place of an organisation: invite, list, remove. */
export default function OrgRjs({ organisationId }: { organisationId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [unitId, setUnitId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await api<Data>(`/orgs/${organisationId}/rjs`);
    setData(d);
    setUnitId((u) => u ?? d.ownPlace ?? "");
  }, [organisationId]);

  useEffect(() => {
    load()
      .then(() => {
        // Opened from "Invite or remove RJs": scroll here once loaded.
        if (window.location.hash === "#rjs") setTimeout(() => document.getElementById("rjs")?.scrollIntoView({ behavior: "smooth" }), 300);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load RJs."));
  }, [load]);

  async function act(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(done);
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!data) return error ? <Card title="RJs"><Notice kind="error" text={error} /></Card> : null;
  const network = data.organisation.kind === "network";
  const placeName = (id: string | null) => (id ? data.places.find((p) => p.id === id)?.name ?? "—" : network ? "Head office" : data.organisation.name);
  // Staff add RJs only at their own place; Super Admin anywhere.
  const invitePlaces: { id: string; name: string }[] = data.superadmin
    ? [{ id: "", name: network ? "Head office" : data.organisation.name }, ...(network ? data.places : [])]
    : [{ id: data.ownPlace ?? "", name: placeName(data.ownPlace) }];

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (await act(() => api(`/orgs/${organisationId}/rj-invites`, { method: "POST", body: JSON.stringify({ email, unitId: unitId || null }) }), `Invite created for ${email.trim()}. Copy the link below and send it to the RJ.`)) {
      setEmail("");
    }
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(link(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copy this link:", link(token));
    }
  }

  return (
    <div id="rjs">
      <Card title="RJs">
        <p className="text-sm text-zinc-600">
          RJs join {network ? "head office, a region or a station" : "your station"} by invite. Staff with Edit on RJs add and remove RJs at their own place.
        </p>
        {message ? <Notice kind="ok" text={message} /> : null}
        {error ? <Notice kind="error" text={error} /> : null}
        {data.rjs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No RJs have joined through an invite yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {data.rjs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <Link href={`/rj/${r.slug}`} className="font-semibold text-zinc-900 hover:text-orange-700">{r.name}</Link>
                  <p className="text-sm text-zinc-600">{placeName(r.unitId)} · since {new Date(r.joinedOn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                {r.editable ? (
                  <button
                    type="button"
                    disabled={busy}
                    className={dangerButton}
                    onClick={() =>
                      window.confirm(`Remove ${r.name} from ${placeName(r.unitId)}? Their profile and followers stay with them; they stop hosting this place's programmes from today.`) &&
                      void act(() => api(`/orgs/${organisationId}/rjs/${r.id}`, { method: "DELETE" }), `${r.name} removed. They will see a notice on their dashboard.`)
                    }
                  >
                    <UserMinus size={14} aria-hidden="true" /> Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {data.canEdit ? (
          <form onSubmit={invite} className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2">
            <h3 className="font-bold text-zinc-900 sm:col-span-2">Invite an RJ</h3>
            <div>
              <label htmlFor="rj-email" className={labelClass}>RJ&apos;s email (their Google account)</label>
              <input id="rj-email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="rj-place" className={labelClass}>Place</label>
              <select id="rj-place" value={unitId ?? ""} onChange={(e) => setUnitId(e.target.value)} className={inputClass} disabled={invitePlaces.length === 1}>
                {invitePlaces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className={primaryButton}>
                {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} Create invite
              </button>
              <p className="mt-2 text-xs text-zinc-500">The RJ accepts or declines on their dashboard. A new RJ first creates their RJ profile.</p>
            </div>
          </form>
        ) : null}

        {data.invites.length ? (
          <>
            <h3 className="mt-6 font-bold text-zinc-900">Open RJ invites</h3>
            <ul className="mt-2 divide-y divide-zinc-100">
              {data.invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900">{i.email}</p>
                    <p className="text-sm text-zinc-600">
                      {placeName(i.unitId)} ·{" "}
                      {i.expired ? <span className="text-red-700">Expired</span> : `Expires ${new Date(i.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                    </p>
                  </div>
                  {i.editable ? (
                    <div className="flex flex-wrap gap-2">
                      {!i.expired ? (
                        <>
                          <button type="button" className={quietButton} onClick={() => void copy(i.token)}>
                            {copied === i.token ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied === i.token ? "Copied" : "Copy link"}
                          </button>
                          <a
                            className={quietButton}
                            target="_blank"
                            rel="noreferrer"
                            href={`https://wa.me/?text=${encodeURIComponent(`${data.organisation.name} invites you to join as an RJ at ${placeName(i.unitId)} on NowRJ. Sign in with ${i.email}: ${link(i.token)}`)}`}
                          >
                            <MessageCircle size={14} aria-hidden="true" /> WhatsApp
                          </a>
                        </>
                      ) : null}
                      <button type="button" disabled={busy} className={dangerButton} onClick={() => void act(() => api(`/orgs/${organisationId}/rj-invites/${i.id}`, { method: "DELETE" }), "Invite cancelled.")}>
                        <X size={14} aria-hidden="true" /> Cancel
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Card>
    </div>
  );
}
