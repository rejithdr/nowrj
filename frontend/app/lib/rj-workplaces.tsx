"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Info, X } from "lucide-react";
import { api, Notice, primaryButton, quietButton } from "./ui";

type Invite = { id: string; token: string; organisationName: string; organisationKind: string; place: string; placeKind: string };
type Place = { id: string; organisationName: string; organisationKind: string; place: string; joinedOn: string };
type NoticeRow = { id: string; text: string; createdAt: string };

/** On the RJ dashboard: notices, station invites to accept or decline, and where the RJ works. */
export default function RjWorkplaces({ onChanged }: { onChanged?: () => Promise<void> }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [i, p, n] = await Promise.all([
      api<Invite[]>("/rj-invites/mine"),
      api<Place[]>("/rj-invites/places"),
      api<NoticeRow[]>("/notices/mine"),
    ]);
    setInvites(i);
    setPlaces(p);
    setNotices(n);
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function decide(invite: Invite, accept: boolean) {
    setBusy(invite.id);
    setError("");
    setMessage("");
    try {
      await api(`/rj-invites/${invite.token}/${accept ? "accept" : "decline"}`, { method: "POST" });
      setMessage(accept ? `You joined ${invite.place} (${invite.organisationName}).` : "Invite declined.");
      await load();
      await onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not answer the invite.");
    } finally {
      setBusy(null);
    }
  }

  async function dismiss(id: string) {
    await api(`/notices/${id}/read`, { method: "POST" }).catch(() => undefined);
    setNotices((n) => n.filter((x) => x.id !== id));
  }

  if (!invites.length && !places.length && !notices.length && !message && !error) return null;

  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-zinc-900">Stations you work with</h2>
      {notices.map((n) => (
        <div key={n.id} className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex gap-2"><Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{n.text}</p>
          <button type="button" onClick={() => void dismiss(n.id)} className="shrink-0 font-semibold hover:underline">Dismiss</button>
        </div>
      ))}
      {message ? <Notice kind="ok" text={message} /> : null}
      {error ? <Notice kind="error" text={error} /> : null}
      {invites.length ? (
        <ul className="mt-3 space-y-3">
          {invites.map((i) => (
            <li key={i.id} className="rounded-xl bg-orange-50 p-3">
              <p className="font-semibold text-zinc-900">{i.organisationName} invites you as an RJ</p>
              <p className="text-sm text-zinc-700">at {i.place}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy !== null} onClick={() => void decide(i, true)} className={primaryButton}>
                  <Check size={16} aria-hidden="true" /> Accept
                </button>
                <button type="button" disabled={busy !== null} onClick={() => void decide(i, false)} className={quietButton}>
                  <X size={14} aria-hidden="true" /> Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {places.length ? (
        <ul className="mt-3 divide-y divide-zinc-100">
          {places.map((p) => (
            <li key={p.id} className="py-2 text-sm text-zinc-700">
              <span className="font-semibold text-zinc-900">{p.place}</span>
              {p.organisationKind === "network" ? ` · ${p.organisationName}` : ""} · since{" "}
              {new Date(p.joinedOn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
