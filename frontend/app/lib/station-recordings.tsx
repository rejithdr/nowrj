"use client";

import { useCallback, useEffect, useState } from "react";
import { Disc3, LoaderCircle, Plus, Share2, Trash2 } from "lucide-react";
import { api, inputClass, labelClass, Notice, primaryButton, quietButton } from "./ui";

type Airing = { showId: string; startsAt: string; endsAt: string; stationId: string; stationName: string; programmeName: string; interactions: number };
type Recording = {
  id: string;
  title: string;
  guestName: string | null;
  description: string | null;
  mine: boolean;
  ownerStationName: string;
  airings: Airing[];
  sharedWith: { stationId: string; stationName: string }[];
};
type Show = { id: string; startsAt: string; endsAt: string; programmeName: string; recordingId: string | null };
type Data = { recordings: Recording[]; shows: Show[]; stations: { id: string; name: string; city: string | null }[] };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });

/**
 * Recordings that play more than once: create one, add the shows it plays
 * in (the first is the premiere, the rest are repeats), offer it to other
 * stations, and add recordings other stations offered.
 */
export default function StationRecordings({ stationId, canEdit }: { stationId: string; canEdit: boolean }) {
  const base = `/stations/${stationId}/recordings`;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", guestName: "", description: "", showId: "" });

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(base));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load recordings.");
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(done);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return error ? <Notice kind="error" text={error} /> : <p className="mt-2 text-sm text-zinc-500">Loading…</p>;
  const freeShows = data.shows.filter((s) => !s.recordingId);
  const showOption = (s: Show) => <option key={s.id} value={s.id}>{when(s.startsAt)} · {s.programmeName}</option>;

  return (
    <div className="mt-2">
      {error ? <Notice kind="error" text={error} /> : null}
      {message ? <Notice kind="ok" text={message} /> : null}

      {data.recordings.length === 0 ? <p className="text-sm text-zinc-600">No recordings yet.</p> : null}
      <ul className="space-y-4">
        {data.recordings.map((r) => {
          const total = r.airings.reduce((n, a) => n + Number(a.interactions), 0);
          const ours = r.airings.filter((a) => a.stationId === stationId);
          return (
            <li key={r.id} className="rounded-xl border border-zinc-200 p-3">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900">
                <Disc3 size={16} className="text-sky-700" aria-hidden="true" /> {r.title}
                {!r.mine ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">Offered by {r.ownerStationName}</span> : null}
              </p>
              {r.guestName ? <p className="text-sm text-zinc-700">With {r.guestName}</p> : null}
              <p className="mt-1 text-xs text-zinc-500">
                {r.airings.length} airing{r.airings.length === 1 ? "" : "s"} · {total} listener interactions in all
                {r.mine && r.sharedWith.length ? ` · offered to ${r.sharedWith.map((s) => s.stationName).join(", ")}` : ""}
              </p>
              <ol className="mt-2 space-y-1 text-sm">
                {r.airings.map((a, i) => (
                  <li key={a.showId} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className={`mr-2 rounded-full px-1.5 py-0.5 text-xs font-semibold ${i === 0 ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>
                        {i === 0 ? "Premiere" : "Repeat"}
                      </span>
                      {when(a.startsAt)} · {a.stationName} · {a.programmeName}
                      <span className="ml-2 text-xs text-zinc-500">{a.interactions} interactions</span>
                    </span>
                    {canEdit && a.stationId === stationId && new Date(a.endsAt) > new Date() ? (
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Remove the airing on ${when(a.startsAt)}`}
                        onClick={() => void act(() => api(`${base}/airings/${a.showId}`, { method: "DELETE" }), "Airing removed.")}
                        className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ol>
              {canEdit ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <select
                    aria-label={`Add ${r.title} to one of your shows`}
                    value=""
                    disabled={busy || !freeShows.length}
                    onChange={(e) => e.target.value && void act(() => api(`${base}/${r.id}/airings`, { method: "POST", body: JSON.stringify({ showId: e.target.value }) }), "Airing added.")}
                    className={`${inputClass} sm:flex-1`}
                  >
                    <option value="">{freeShows.length ? (ours.length ? "+ Add another airing on…" : "+ Play it on…") : "No free shows in the next 14 days"}</option>
                    {freeShows.map(showOption)}
                  </select>
                  {r.mine ? (
                    <select
                      aria-label={`Offer ${r.title} to another station`}
                      value=""
                      disabled={busy}
                      onChange={(e) => e.target.value && void act(() => api(`${base}/${r.id}/share`, { method: "POST", body: JSON.stringify({ stationId: e.target.value }) }), "Offered. That station can now add it to its shows.")}
                      className={`${inputClass} sm:flex-1`}
                    >
                      <option value="">Offer to another station…</option>
                      {data.stations
                        .filter((s) => !r.sharedWith.some((x) => x.stationId === s.id))
                        .map((s) => <option key={s.id} value={s.id}>{s.name}{s.city ? ` · ${s.city}` : ""}</option>)}
                    </select>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {canEdit ? (
        creating ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                await api(base, { method: "POST", body: JSON.stringify(form) });
                setCreating(false);
                setForm({ title: "", guestName: "", description: "", showId: "" });
              }, "Recording saved.");
            }}
            className="mt-4 grid gap-3 rounded-xl bg-zinc-50 p-4"
          >
            <div>
              <label htmlFor="rec-title" className={labelClass}>Title *</label>
              <input id="rec-title" required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Talk with Rafi: eating right" className={inputClass} />
            </div>
            <div>
              <label htmlFor="rec-guest" className={labelClass}>Guest</label>
              <input id="rec-guest" maxLength={120} value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} placeholder="Dr Anjali, nutritionist" className={inputClass} />
            </div>
            <div>
              <label htmlFor="rec-desc" className={labelClass}>Description</label>
              <textarea id="rec-desc" maxLength={500} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} py-2`} />
            </div>
            <div>
              <label htmlFor="rec-show" className={labelClass}>First airing (premiere)</label>
              <select id="rec-show" value={form.showId} onChange={(e) => setForm({ ...form, showId: e.target.value })} className={inputClass}>
                <option value="">Choose later</option>
                {freeShows.map(showOption)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={primaryButton}>
                {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null} Save recording
              </button>
              <button type="button" onClick={() => setCreating(false)} className={quietButton}>Cancel</button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setCreating(true)} className={`${quietButton} mt-4`}>
            <Plus size={16} aria-hidden="true" /> Add a recording
          </button>
        )
      ) : null}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
        <Share2 size={12} aria-hidden="true" /> Repeats show listeners when it first aired; requests are off for them, Like, Fire and polls stay on. Ads on each airing are that station&apos;s.
      </p>
    </div>
  );
}
