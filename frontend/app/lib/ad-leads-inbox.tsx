"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, MessageSquare, Phone, Send } from "lucide-react";
import { api, Notice, StatusPill } from "./ui";

type Reply = { id: string; fromBusiness: boolean; body: string; createdAt: string };
type Lead = {
  id: string;
  kind: "phone" | "message";
  name: string;
  phone: string | null;
  message: string | null;
  status: "new" | "contacted" | "closed";
  priceInr: number;
  withdrawnAt: string | null;
  phoneClearedAt: string | null;
  createdAt: string;
  adTitle: string;
  stationName: string;
  programmeName: string | null;
  replies: Reply[];
};
type Data = { pricePerLead: number; thisMonth: { leads: number; amountInr: number }; leads: Lead[] };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const small = "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold disabled:opacity-50";

/** A business's "I'm interested" leads: call them, or reply to messages. */
export default function AdLeadsInbox({ advertiserId, businessName }: { advertiserId: string; businessName: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(`/advertiser/leads?advertiserId=${advertiserId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leads.");
    }
  }, [advertiserId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function act(id: string, run: () => Promise<unknown>) {
    setBusy(id);
    setError("");
    try {
      await run();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  if (!data) return error ? <Notice kind="error" text={error} /> : <p className="mt-3 text-sm text-zinc-600"><LoaderCircle className="mr-2 inline animate-spin" size={16} aria-hidden="true" />Loading…</p>;

  return (
    <div className="mt-3">
      <p className="text-sm text-zinc-700">
        This month: <strong>{data.thisMonth.leads}</strong> interested listener{data.thisMonth.leads === 1 ? "" : "s"} · {rupees(data.thisMonth.amountInr)} at {rupees(data.pricePerLead)} a lead
        <span className="block text-xs text-zinc-500">The rate is a placeholder for the pilot; nothing is charged yet.</span>
      </p>
      {error ? <Notice kind="error" text={error} /> : null}
      {data.leads.length === 0 ? <p className="mt-2 text-sm text-zinc-600">No one has tapped &ldquo;I&apos;m interested&rdquo; yet.</p> : null}
      <ul className="mt-2 divide-y divide-zinc-100">
        {data.leads.map((l) => (
          <li key={l.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900">
                  {l.kind === "phone" ? <Phone size={14} className="mr-1 inline" aria-hidden="true" /> : <MessageSquare size={14} className="mr-1 inline" aria-hidden="true" />}
                  {l.name}
                </p>
                <p className="text-xs text-zinc-500">{l.adTitle} · {l.stationName}{l.programmeName ? ` · heard on ${l.programmeName}` : ""} · {when(l.createdAt)}</p>
                {l.phone ? (
                  <a href={`tel:${l.phone.replace(/[^0-9+]/g, "")}`} className="mt-1 inline-flex items-center gap-1 font-semibold text-orange-700"><Phone size={13} aria-hidden="true" />{l.phone}</a>
                ) : l.kind === "phone" ? (
                  <p className="mt-1 text-xs text-zinc-500">{l.withdrawnAt ? "The listener withdrew and their number was removed." : "Number removed after 90 days."}</p>
                ) : null}
              </div>
              <StatusPill text={l.withdrawnAt ? "Withdrawn" : l.status === "new" ? "New" : l.status === "contacted" ? "Contacted" : "Closed"} tone={l.withdrawnAt ? "zinc" : l.status === "new" ? "amber" : l.status === "contacted" ? "green" : "zinc"} />
            </div>
            <ul className="mt-2 space-y-1.5">
              {l.message ? <li className="mr-8 rounded-lg bg-zinc-50 p-2 text-zinc-900">{l.message}</li> : null}
              {l.replies.map((r) => (
                <li key={r.id} className={`rounded-lg p-2 ${r.fromBusiness ? "ml-8 border-l-4 border-orange-300 bg-orange-50/50" : "mr-8 bg-zinc-50"}`}>
                  <span className="block text-xs text-zinc-500">{r.fromBusiness ? businessName : l.name} · {when(r.createdAt)}</span>
                  {r.body}
                </li>
              ))}
            </ul>
            {!l.withdrawnAt ? (
              <>
                <div className="mt-2 flex gap-2">
                  <label htmlFor={`lr-${l.id}`} className="sr-only">Reply to {l.name}</label>
                  <input
                    id={`lr-${l.id}`}
                    maxLength={500}
                    value={drafts[l.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: e.target.value }))}
                    placeholder="Reply in NowRJ…"
                    className="min-h-10 w-full rounded-lg border border-zinc-300 px-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                  <button
                    type="button"
                    disabled={busy === l.id || !(drafts[l.id] ?? "").trim()}
                    onClick={() => void act(l.id, async () => {
                      await api(`/advertiser/leads/${l.id}/replies`, { method: "POST", body: JSON.stringify({ body: drafts[l.id] }) });
                      setDrafts((d) => ({ ...d, [l.id]: "" }));
                    })}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-orange-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Send size={14} aria-hidden="true" /> Reply
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {l.status !== "contacted" ? <button type="button" disabled={busy === l.id} onClick={() => void act(l.id, () => api(`/advertiser/leads/${l.id}`, { method: "PATCH", body: JSON.stringify({ status: "contacted" }) }))} className={`${small} border-emerald-300 text-emerald-800`}>Contacted</button> : null}
                  {l.status !== "closed" ? <button type="button" disabled={busy === l.id} onClick={() => void act(l.id, () => api(`/advertiser/leads/${l.id}`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) }))} className={`${small} border-zinc-300 text-zinc-700`}>Close</button> : null}
                  {l.status !== "new" ? <button type="button" disabled={busy === l.id} onClick={() => void act(l.id, () => api(`/advertiser/leads/${l.id}`, { method: "PATCH", body: JSON.stringify({ status: "new" }) }))} className={`${small} border-zinc-200 text-zinc-500`}>Mark new</button> : null}
                </div>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
