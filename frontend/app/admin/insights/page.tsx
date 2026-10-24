"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AuthControls from "../../AuthControls";
import { api, Card, Notice } from "../../lib/ui";

type Week = {
  week: string;
  newListeners: number;
  referredListeners: number;
  activeListeners: number;
  returningListeners: number;
  likes: number;
  fires: number;
  callTaps: number;
  songRequests: number;
  questions: number;
  follows: number;
};
type Insights = {
  totals: Record<string, number>;
  series: Week[];
  funnel: { registered: number; withStation: number; withProgramme: number; verified: number; activeLast7Days: number };
  topRjs: { name: string; slug: string; followers: number; interactions: number }[];
  topProgrammes: { name: string; slug: string; station: string | null; shows: number; interactions: number }[];
};

// Validated categorical slots 1 and 2 (blue, orange).
const SERIES = ["#2a78d6", "#eb6834"];

const weekLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Tile({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900">{value.toLocaleString("en-IN")}</p>
      <p className="mt-1 text-xs text-zinc-500">{note}</p>
    </div>
  );
}

/** Two-part weekly bars: the parts add up to the bar's total. */
function StackedWeeks({
  title,
  weeks,
  parts,
}: {
  title: string;
  weeks: Week[];
  parts: { label: string; value: (w: Week) => number }[];
}) {
  const W = 640, H = 230, left = 36, right = 12, top = 24, bottom = 28;
  const max = Math.max(1, ...weeks.map((w) => parts.reduce((n, p) => n + p.value(w), 0)));
  const step = Math.max(1, Math.ceil(max / 4));
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  const top_ = ticks[ticks.length - 1] || 1;
  const y = (v: number) => top + (H - top - bottom) * (1 - v / top_);
  const band = (W - left - right) / weeks.length;
  const barW = Math.min(44, band * 0.6);

  return (
    <figure className="mt-4">
      <figcaption className="text-sm font-semibold text-zinc-900">{title}</figcaption>
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-zinc-600">
        {parts.map((p, i) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i] }} aria-hidden="true" />
            {p.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="#e4e4e7" strokeWidth="1" />
            <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#71717a">{t}</text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x = left + band * i + (band - barW) / 2;
          let base = 0;
          const total = parts.reduce((n, p) => n + p.value(w), 0);
          return (
            <g key={w.week}>
              {parts.map((p, j) => {
                const v = p.value(w);
                const y1 = y(base + v);
                const h = y(base) - y1;
                base += v;
                return v > 0 ? (
                  <rect key={p.label} x={x} y={y1 + (j > 0 ? 1 : 0)} width={barW} height={Math.max(0, h - (j > 0 ? 2 : 0))} rx="3" fill={SERIES[j]}>
                    <title>{`${weekLabel(w.week)} week: ${p.label} ${v}`}</title>
                  </rect>
                ) : null;
              })}
              {total > 0 ? (
                <text x={x + barW / 2} y={y(total) - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#3f3f46">{total}</text>
              ) : null}
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#71717a">{weekLabel(w.week)}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Insights>("/admin/insights")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load. Are you signed in as a Super Admin?"));
  }, []);

  const t = data?.totals;
  const thisWeek = data?.series[data.series.length - 1];
  const funnelSteps = data
    ? [
        { label: "Registered", value: data.funnel.registered },
        { label: "Set their station", value: data.funnel.withStation },
        { label: "Added a programme", value: data.funnel.withProgramme },
        { label: "Verified", value: data.funnel.verified },
        { label: "Got listener interactions this week", value: data.funnel.activeLast7Days },
      ]
    : [];

  return (
    <main className="bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin/rjs" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 hover:underline">
            <ArrowLeft size={16} aria-hidden="true" />
            RJ management
          </Link>
          <AuthControls />
        </div>
        <h1 className="mt-3 text-3xl font-bold text-zinc-900">Platform insights</h1>
        <p className="mt-1 text-sm text-zinc-600">Are RJs bringing their listeners, and are those listeners coming back? Weeks run Monday to Sunday, India time.</p>
        {error ? <Notice kind="error" text={error} /> : null}

        {data && t && thisWeek ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Tile label="Listeners" value={t.listeners} note={`${t.referredListeners} joined through an RJ's link`} />
              <Tile label="Live RJs" value={t.rjsLive} note={`${t.rjsPending} waiting for verification`} />
              <Tile label="Live stations" value={t.stationsLive} note={`${t.stationsPending} waiting for verification`} />
              <Tile label="Live programmes" value={t.programmesLive} note={`${t.programmesStationOwned} owned by stations`} />
              <Tile label="RJ referrals" value={t.rjReferrals} note={`${t.rjReferralsVerified} verified · rewards start with Now On FM ads`} />
              <Tile label="Active listeners this week" value={thisWeek.activeListeners} note={`${thisWeek.returningListeners} came back from earlier weeks`} />
            </div>

            <Card title="Listeners">
              <StackedWeeks
                title="New listeners per week"
                weeks={data.series}
                parts={[
                  { label: "Through an RJ's link", value: (w) => w.referredListeners },
                  { label: "Came directly", value: (w) => Math.max(0, w.newListeners - w.referredListeners) },
                ]}
              />
              <StackedWeeks
                title="Active listeners per week (liked, fired, followed, requested or called while signed in)"
                weeks={data.series}
                parts={[
                  { label: "Returning from an earlier week", value: (w) => w.returningListeners },
                  { label: "Active for the first time", value: (w) => Math.max(0, w.activeListeners - w.returningListeners) },
                ]}
              />
            </Card>

            <Card title="Week by week">
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[44rem] text-right text-sm">
                  <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th scope="col" className="py-2 pr-3 text-left font-semibold">Week of</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">New</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Via link</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Active</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Returning</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Likes</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Fires</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Call taps</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Requests</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Questions</th>
                      <th scope="col" className="py-2 font-semibold">Follows</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 tabular-nums">
                    {[...data.series].reverse().map((w) => (
                      <tr key={w.week}>
                        <td className="py-2 pr-3 text-left text-zinc-900">{weekLabel(w.week)}</td>
                        <td className="py-2 pr-3">{w.newListeners}</td>
                        <td className="py-2 pr-3">{w.referredListeners}</td>
                        <td className="py-2 pr-3">{w.activeListeners}</td>
                        <td className="py-2 pr-3">{w.returningListeners}</td>
                        <td className="py-2 pr-3">{w.likes}</td>
                        <td className="py-2 pr-3">{w.fires}</td>
                        <td className="py-2 pr-3">{w.callTaps}</td>
                        <td className="py-2 pr-3">{w.songRequests}</td>
                        <td className="py-2 pr-3">{w.questions}</td>
                        <td className="py-2">{w.follows}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-zinc-500">Call taps include signed-out listeners; active and returning listeners count signed-in people only.</p>
            </Card>

            <Card title="RJ progress">
              <ul className="mt-3 space-y-2">
                {funnelSteps.map((s) => (
                  <li key={s.label}>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-800">{s.label}</span>
                      <span className="font-semibold tabular-nums text-zinc-900">{s.value}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-zinc-100">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${funnelSteps[0].value ? (s.value / funnelSteps[0].value) * 100 : 0}%`, background: SERIES[0] }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
              <Card title="Top RJs this week">
                {data.topRjs.length ? (
                  <ol className="mt-3 space-y-2 text-sm">
                    {data.topRjs.map((r, i) => (
                      <li key={r.slug} className="flex justify-between gap-2">
                        <Link href={`/rj/${r.slug}`} className="font-semibold text-zinc-900 hover:text-orange-700">{i + 1}. {r.name}</Link>
                        <span className="tabular-nums text-zinc-600">{r.interactions} interactions · {r.followers} followers</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-zinc-600">No shows with interactions this week.</p>
                )}
              </Card>
              <Card title="Top programmes this week">
                {data.topProgrammes.length ? (
                  <ol className="mt-3 space-y-2 text-sm">
                    {data.topProgrammes.map((p, i) => (
                      <li key={p.slug} className="flex justify-between gap-2">
                        <Link href={`/programme/${p.slug}`} className="font-semibold text-zinc-900 hover:text-orange-700">{i + 1}. {p.name}</Link>
                        <span className="tabular-nums text-zinc-600">{p.interactions} interactions · {p.shows} shows</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-zinc-600">No shows with interactions this week.</p>
                )}
              </Card>
            </div>
            <p className="mt-4 pb-6 text-xs text-zinc-500">Interactions are Likes, Fires, song requests, questions and call taps on shows.</p>
          </>
        ) : !error ? (
          <p className="mt-6 text-zinc-600">Loading…</p>
        ) : null}
      </div>
    </main>
  );
}
