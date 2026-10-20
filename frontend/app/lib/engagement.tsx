"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Notice } from "./ui";

type Totals = { shows: number; likes: number; fires: number; callTaps: number; callers: number };
type ShowRow = {
  id: string;
  airDate: string;
  startsAt: string;
  programmeName: string;
  programmeSlug: string;
  hosts: string | null;
  likes: number;
  fires: number;
  callTaps: number;
  callers: number;
  live: boolean;
};
type Engagement = {
  followers?: { total: number; new7Days: number };
  last7Days: Totals;
  previous7Days: Totals;
  shows: ShowRow[];
};

function change(now: number, before: number) {
  const diff = now - before;
  if (diff === 0) return "Same as the week before";
  return `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} vs the week before`;
}

function Tile({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900">{value.toLocaleString("en-IN")}</p>
      <p className="mt-1 text-xs text-zinc-500">{note}</p>
    </div>
  );
}

function showDate(row: ShowRow) {
  return new Date(row.startsAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Engagement for an RJ or a station: this week's totals compared with the
 * week before, and every show in the last 14 days.
 */
export default function EngagementPanel({ path, showHosts }: { path: string; showHosts: boolean }) {
  const [data, setData] = useState<Engagement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Engagement>(path)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load engagement."));
  }, [path]);

  if (error) return <Notice kind="error" text={error} />;
  if (!data) return <p className="mt-3 text-sm text-zinc-500">Loading engagement…</p>;

  const w = data.last7Days;
  const p = data.previous7Days;

  return (
    <div className="mt-3">
      <p className="text-sm text-zinc-600">
        Last 7 days · {w.shows} show{w.shows === 1 ? "" : "s"} aired
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.followers ? (
          <Tile
            label="Followers"
            value={data.followers.total}
            note={data.followers.new7Days ? `▲ ${data.followers.new7Days} new this week` : "No new followers this week"}
          />
        ) : null}
        <Tile label="Likes" value={w.likes} note={change(w.likes, p.likes)} />
        <Tile label="Fires" value={w.fires} note={change(w.fires, p.fires)} />
        <Tile label="Call taps" value={w.callTaps} note={change(w.callTaps, p.callTaps)} />
        {!data.followers ? <Tile label="Shows aired" value={w.shows} note={change(w.shows, p.shows)} /> : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        A call tap means a listener pressed Call on the show card. It does not confirm the call got through.
      </p>

      <h3 className="mt-6 text-sm font-semibold text-zinc-800">Shows in the last 14 days</h3>
      {data.shows.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">No shows have aired yet. Shows appear here once they start.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th scope="col" className="py-2 pr-3 font-semibold">Show</th>
                {showHosts ? <th scope="col" className="py-2 pr-3 font-semibold">Hosts</th> : null}
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Likes</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Fires</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Call taps</th>
                <th scope="col" className="py-2 text-right font-semibold">Callers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.shows.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-3">
                    <Link href={`/programme/${row.programmeSlug}`} className="font-semibold text-zinc-900 hover:text-orange-700">
                      {row.programmeName}
                    </Link>
                    <span className="block text-xs text-zinc-500">
                      {showDate(row)}
                      {row.live ? <span className="ml-1.5 font-bold uppercase text-red-700">· Live</span> : null}
                    </span>
                  </td>
                  {showHosts ? <td className="py-2 pr-3 text-zinc-700">{row.hosts ?? "—"}</td> : null}
                  <td className="py-2 pr-3 text-right tabular-nums">{row.likes}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.fires}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.callTaps}</td>
                  <td className="py-2 text-right tabular-nums">{row.callers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
