"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Notice } from "./ui";

type Numbers = {
  days: number;
  from: string;
  to: string;
  funnel: { step: string; people: number }[];
  returns: { cohort: number; returned: number; percent: number | null };
  sharing?: { shared: number; arrived: number };
  interactions: { reactions: number; votes: number; messages: number; callTaps: number; people: number; total: number; perPerson: number | null };
  daily: { day: string; opened: number; tapped: number }[];
};

const STEP: Record<string, string> = {
  open: "Opened NowRJ",
  tap: "Tapped something",
  signin_prompt: "Asked to sign in",
  signin: "Signed in",
  message: "Sent a message",
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const shortDay = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/**
 * Pilot numbers: drop-off by step, 7-day returns, interactions per listener
 * and a daily chart. `path` is /admin/pilot (all of NowRJ, optionally one
 * station) or /stations/<id>/pilot (one station).
 */
export default function PilotNumbers({ path, stations }: { path: string; stations?: { id: string; name: string }[] }) {
  const [days, setDays] = useState(30);
  const [stationId, setStationId] = useState("");
  const [data, setData] = useState<Numbers | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const sep = path.includes("?") ? "&" : "?";
      setData(await api<Numbers>(`${path}${sep}days=${days}${stationId ? `&stationId=${stationId}` : ""}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the numbers.");
    }
  }, [path, days, stationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const top = data ? Math.max(1, ...data.funnel.map((f) => f.people)) : 1;
  const peak = data ? Math.max(1, ...data.daily.map((d) => Math.max(d.opened, d.tapped))) : 1;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={days === d}
            onClick={() => setDays(d)}
            className={`min-h-9 rounded-full border px-3 text-sm font-semibold ${days === d ? "border-orange-400 bg-orange-50 text-orange-800" : "border-zinc-300 bg-white text-zinc-700"}`}
          >
            Last {d} days
          </button>
        ))}
        {stations ? (
          <select aria-label="Station" value={stationId} onChange={(e) => setStationId(e.target.value)} className="min-h-9 rounded-full border border-zinc-300 bg-white px-3 text-sm">
            <option value="">All stations</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : null}
      </div>
      {error ? <Notice kind="error" text={error} /> : null}
      {!data && !error ? <p className="mt-3 text-sm text-zinc-500">Loading…</p> : null}
      {data ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Came back within 7 days</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{data.returns.percent === null ? "—" : `${data.returns.percent}%`}</p>
              <p className="text-xs text-zinc-600">{data.returns.returned} of {data.returns.cohort} new phones (first seen at least 7 days ago)</p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Interactions per listener</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{data.interactions.perPerson ?? "—"}</p>
              <p className="text-xs text-zinc-600">{data.interactions.total} interactions from {data.interactions.people} listeners</p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Interactions</p>
              <p className="mt-1 text-sm text-zinc-800">
                {plural(data.interactions.reactions, "like or fire", "likes & fire")} · {plural(data.interactions.votes, "poll vote")} ·{" "}
                {plural(data.interactions.messages, "message")} · {plural(data.interactions.callTaps, "call tap")}
              </p>
            </div>
          </div>
          {data.sharing ? (
            <div className="mt-3 rounded-xl bg-orange-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">Sharing</p>
              <p className="mt-1 text-sm text-zinc-800">
                {plural(data.sharing.shared, "person", "people")} shared a NowRJ link · {plural(data.sharing.arrived, "phone")} came from a shared link
              </p>
            </div>
          ) : null}

          <h3 className="mt-5 text-sm font-semibold text-zinc-900">Where people drop off</h3>
          <p className="text-xs text-zinc-500">Different phones or listeners at each step, {shortDay(data.from)} – {shortDay(data.to)}.</p>
          <ol className="mt-2 space-y-1.5">
            {data.funnel.map((f, i) => {
              const prev = i > 0 ? data.funnel[i - 1].people : null;
              const kept = prev ? Math.round((f.people / prev) * 100) : null;
              return (
                <li key={f.step} className="relative overflow-hidden rounded-lg bg-zinc-50">
                  <div className="absolute inset-y-0 left-0 bg-orange-100" style={{ width: `${(f.people / top) * 100}%` }} aria-hidden="true" />
                  <div className="relative flex justify-between gap-2 px-3 py-2 text-sm">
                    <span className="font-medium text-zinc-900">{STEP[f.step] ?? f.step}</span>
                    <span className="tabular-nums text-zinc-700">
                      {f.people}
                      {kept !== null ? <span className="ml-2 text-xs text-zinc-500">{kept}% of previous</span> : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          <h3 className="mt-5 text-sm font-semibold text-zinc-900">Each day</h3>
          <p className="text-xs text-zinc-500"><span className="inline-block h-2 w-2 rounded-sm bg-zinc-300" /> opened · <span className="inline-block h-2 w-2 rounded-sm bg-orange-500" /> did something</p>
          <div className="mt-2 flex h-28 items-end gap-0.5" role="img" aria-label="Phones that opened NowRJ and that did something, each day">
            {data.daily.map((d) => (
              <div key={d.day} className="flex h-full flex-1 items-end gap-px" title={`${shortDay(d.day)}: ${d.opened} opened, ${d.tapped} did something`}>
                <div className="flex-1 rounded-t bg-zinc-300" style={{ height: `${(d.opened / peak) * 100}%` }} />
                <div className="flex-1 rounded-t bg-orange-500" style={{ height: `${(d.tapped / peak) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-zinc-500">
            <span>{shortDay(data.from)}</span>
            <span>{shortDay(data.to)}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
