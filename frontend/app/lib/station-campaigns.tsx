"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, Mic, Plus, X } from "lucide-react";
import { api, inputClass, labelClass, Notice, primaryButton, quietButton, StatusPill } from "./ui";

type Kind = "sponsored" | "shoutout" | "aired";
type Can = Record<Kind, { view: boolean; edit: boolean; authorise: boolean }>;
type Ad = {
  id: string;
  kind: Kind;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  businessName: string;
  creativeTitle: string;
  programmeName: string | null;
  showProgrammeName: string | null;
  showStartsAt: string | null;
  startDate: string | null;
  endDate: string | null;
  rejectReason: string | null;
  activatedAt: string | null;
  makerName: string | null;
  checkerName: string | null;
  responses: number;
  calls: number;
  runnable: boolean;
  hasConsent: boolean;
  canApprove: boolean;
  canWithdraw: boolean;
  canPutOnAir: boolean;
};
type Advertiser = { id: string; businessName: string };
type Creative = { id: string; title: string };
type Targets = { programmes: { id: string; name: string }[]; shows: { id: string; startsAt: string; endsAt: string; programmeName: string }[]; today: string };

export const KIND_LABEL: Record<Kind, string> = { sponsored: "Sponsored", shoutout: "RJ shout-out", aired: "Aired spot" };
const STATUS: Record<Ad["status"], { text: string; tone: "green" | "amber" | "red" | "zinc" }> = {
  pending: { text: "Waiting for approval", tone: "amber" },
  approved: { text: "Approved", tone: "green" },
  rejected: { text: "Not approved", tone: "red" },
  withdrawn: { text: "Withdrawn", tone: "zinc" },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** The station's ads: enter, approve (someone else), put shout-outs on air, withdraw. */
export default function StationCampaigns({ stationId, advertisers }: { stationId: string; advertisers: Advertiser[] }) {
  const base = `/stations/${stationId}/ads`;
  const [data, setData] = useState<{ can: Can; ads: Ad[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => setData(await api(`${base}/campaigns`)), [base]);
  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Could not load ads."));
  }, [load]);

  async function act(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(done);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return error ? <Notice kind="error" text={error} /> : null;
  const canEnter = (Object.keys(data.can) as Kind[]).some((k) => data.can[k].edit);

  return (
    <div>
      <p className="mt-1 text-sm text-zinc-600">Every ad is approved by someone other than the person who entered it. Only approved ads, from advertisers who have given consent, appear to listeners.</p>
      {message ? <Notice kind="ok" text={message} /> : null}
      {error ? <Notice kind="error" text={error} /> : null}
      {data.ads.length === 0 ? <p className="mt-3 text-sm text-zinc-600">No ads yet.</p> : null}
      <ul className="mt-3 divide-y divide-zinc-100">
        {data.ads.map((a) => (
          <li key={a.id} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900">{a.businessName} · {a.creativeTitle}</p>
                <p className="text-sm text-zinc-600">
                  {KIND_LABEL[a.kind]} ·{" "}
                  {a.programmeName
                    ? `${a.programmeName}, ${day(a.startDate!)} – ${day(a.endDate!)}`
                    : `${a.showProgrammeName}, ${a.showStartsAt ? when(a.showStartsAt) : ""}`}
                </p>
                <p className="text-xs text-zinc-500">
                  Entered by {a.makerName ?? "—"}{a.checkerName ? ` · ${a.status === "rejected" ? "Rejected" : "Approved"} by ${a.checkerName}` : ""}
                  {a.status === "approved" ? ` · ${a.responses} response${a.responses === 1 ? "" : "s"} (${a.calls} call${a.calls === 1 ? "" : "s"})` : ""}
                </p>
                {a.status === "rejected" && a.rejectReason ? <p className="text-sm text-red-700">Reason: {a.rejectReason}</p> : null}
                {a.status === "approved" && !a.hasConsent ? <p className="text-sm text-amber-700">Not showing: the advertiser&apos;s consent is not in place.</p> : null}
                {a.kind === "shoutout" && a.activatedAt ? <p className="text-sm text-green-700">On air since {when(a.activatedAt)}</p> : null}
              </div>
              <StatusPill text={STATUS[a.status].text} tone={STATUS[a.status].tone} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {a.canApprove ? (
                <>
                  <button type="button" disabled={busy} className={primaryButton} onClick={() => void act(() => api(`${base}/campaigns/${a.id}/approve`, { method: "POST" }), "Ad approved.")}>
                    <Check size={14} aria-hidden="true" /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={quietButton}
                    onClick={() => {
                      const reason = window.prompt("Why is this ad not approved?");
                      if (reason) void act(() => api(`${base}/campaigns/${a.id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }), "Ad not approved.");
                    }}
                  >
                    <X size={14} aria-hidden="true" /> Reject
                  </button>
                </>
              ) : null}
              {a.canPutOnAir ? (
                <button type="button" disabled={busy} className={primaryButton} onClick={() => void act(() => api(`/ads/${a.id}/on-air`, { method: "POST" }), "Shout-out is on the show card now.")}>
                  <Mic size={14} aria-hidden="true" /> {a.activatedAt ? "Put on air again" : "Put on air"}
                </button>
              ) : null}
              {a.canWithdraw ? (
                <button type="button" disabled={busy} className={quietButton} onClick={() => window.confirm("Withdraw this ad? It stops showing at once.") && void act(() => api(`${base}/campaigns/${a.id}/withdraw`, { method: "POST" }), "Ad withdrawn.")}>
                  Withdraw
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {canEnter ? (
        adding ? (
          <AdForm base={base} can={data.can} advertisers={advertisers} onDone={async (msg) => { setAdding(false); if (msg) setMessage(msg); await load(); }} />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={`${quietButton} mt-3`}>
            <Plus size={14} aria-hidden="true" /> Enter an ad
          </button>
        )
      ) : null}
    </div>
  );
}

function AdForm({ base, can, advertisers, onDone }: { base: string; can: Can; advertisers: Advertiser[]; onDone: (msg?: string) => Promise<void> }) {
  const kinds = (Object.keys(can) as Kind[]).filter((k) => can[k].edit);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [form, setForm] = useState({ kind: kinds[0], advertiserId: "", creativeId: "", by: "dates" as "dates" | "show", programmeId: "", showOccurrenceId: "", startDate: "", endDate: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Targets>(`${base}/targets`).then((t) => {
      setTargets(t);
      setForm((f) => ({ ...f, startDate: t.today, endDate: t.today }));
    }).catch(() => undefined);
  }, [base]);

  useEffect(() => {
    if (!form.advertiserId) return setCreatives([]);
    api<Creative[]>(`${base}/advertisers/${form.advertiserId}/creatives`).then(setCreatives).catch(() => setCreatives([]));
  }, [base, form.advertiserId]);

  const byShow = form.kind === "shoutout" || (form.kind === "aired" && form.by === "show");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`${base}/campaigns`, {
        method: "POST",
        body: JSON.stringify({
          kind: form.kind,
          advertiserId: form.advertiserId,
          creativeId: form.creativeId,
          ...(byShow ? { showOccurrenceId: form.showOccurrenceId } : { programmeId: form.programmeId, startDate: form.startDate, endDate: form.endDate }),
        }),
      });
      await onDone("Ad entered. Someone else with Authorise must approve it before it shows.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enter the ad.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl bg-zinc-50 p-4 sm:grid-cols-2">
      <div>
        <label htmlFor="ad-kind" className={labelClass}>Kind of ad</label>
        <select id="ad-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })} className={inputClass}>
          {kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="ad-adv" className={labelClass}>Advertiser</label>
        <select id="ad-adv" required value={form.advertiserId} onChange={(e) => setForm({ ...form, advertiserId: e.target.value, creativeId: "" })} className={inputClass}>
          <option value="" disabled>Choose…</option>
          {advertisers.map((a) => <option key={a.id} value={a.id}>{a.businessName}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="ad-creative" className={labelClass}>Creative</label>
        <select id="ad-creative" required value={form.creativeId} onChange={(e) => setForm({ ...form, creativeId: e.target.value })} className={inputClass}>
          <option value="" disabled>{form.advertiserId ? (creatives.length ? "Choose…" : "No creatives yet: add one in the ad library") : "Choose the advertiser first"}</option>
          {creatives.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      {form.kind === "aired" ? (
        <div className="flex gap-4 text-sm sm:col-span-2">
          <label className="flex items-center gap-2"><input type="radio" checked={form.by === "dates"} onChange={() => setForm({ ...form, by: "dates" })} /> A programme over dates</label>
          <label className="flex items-center gap-2"><input type="radio" checked={form.by === "show"} onChange={() => setForm({ ...form, by: "show" })} /> One show</label>
        </div>
      ) : null}
      {byShow ? (
        <div className="sm:col-span-2">
          <label htmlFor="ad-show" className={labelClass}>Show</label>
          <select id="ad-show" required value={form.showOccurrenceId} onChange={(e) => setForm({ ...form, showOccurrenceId: e.target.value })} className={inputClass}>
            <option value="" disabled>{targets?.shows.length ? "Choose…" : "No shows coming up"}</option>
            {(targets?.shows ?? []).map((s) => <option key={s.id} value={s.id}>{s.programmeName} · {when(s.startsAt)}</option>)}
          </select>
          {form.kind === "shoutout" ? <p className="mt-1 text-xs text-zinc-500">Once approved, the show&apos;s RJ or station staff put it on air during the show.</p> : null}
        </div>
      ) : (
        <>
          <div className="sm:col-span-2">
            <label htmlFor="ad-prog" className={labelClass}>Programme</label>
            <select id="ad-prog" required value={form.programmeId} onChange={(e) => setForm({ ...form, programmeId: e.target.value })} className={inputClass}>
              <option value="" disabled>Choose…</option>
              {(targets?.programmes ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ad-from" className={labelClass}>First day</label>
            <input id="ad-from" type="date" required min={targets?.today} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="ad-to" className={labelClass}>Last day</label>
            <input id="ad-to" type="date" required min={form.startDate || targets?.today} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputClass} />
          </div>
        </>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} Enter ad
        </button>
        <button type="button" className={quietButton} onClick={() => void onDone()}>Cancel</button>
      </div>
      {error ? <p className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
    </form>
  );
}
