"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthControls from "../../AuthControls";
import { api, Card, Notice } from "../../lib/ui";

type Report = {
  targetType: "programme" | "rj" | "ad";
  targetId: string;
  name: string;
  stationName: string | null;
  count: number;
  reasons: string[];
  details: string[];
  firstAt: string;
  lastAt: string;
};

const REASON: Record<string, string> = {
  wrong_info: "Wrong information",
  offensive: "Offensive",
  spam: "Spam",
  unsafe: "Unsafe",
  other: "Other",
};
const KIND = { programme: "Programme", rj: "RJ", ad: "Ad" } as const;
const HIDE = { programme: "Hide programme", rj: "Hide RJ", ad: "Withdraw ad" } as const;

/** Super Admin: open listener reports, grouped by what was reported. */
export default function ReportsPage() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReports(await api<Report[]>("/admin/reports"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load reports.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handle(r: Report, action: "dismiss" | "hide") {
    setBusy(r.targetId);
    setError("");
    try {
      await api(`/admin/reports/${r.targetType}/${r.targetId}`, { method: "PATCH", body: JSON.stringify({ action }) });
      setMessage(action === "hide" ? `${r.name} is hidden from listeners.` : `Reports about ${r.name} dismissed.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">Now<span className="text-orange-600">RJ</span></Link>
          <AuthControls />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-zinc-900">Reports from listeners</h1>
        <p className="mt-1 text-sm text-zinc-600">Open reports, most reported first. Hiding takes the item off NowRJ for listeners; you can turn it back on from its admin page.</p>
        {error ? <Notice kind="error" text={error} /> : null}
        {message ? <Notice kind="ok" text={message} /> : null}
        <Card>
          {!reports ? <p className="text-sm text-zinc-500">Loading…</p> : null}
          {reports && !reports.length ? <p className="text-sm text-zinc-600">No open reports.</p> : null}
          <ul className="divide-y divide-zinc-100">
            {reports?.map((r) => (
              <li key={`${r.targetType}-${r.targetId}`} className="py-3">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{KIND[r.targetType]}</span>
                  <strong className="text-zinc-900">{r.name}</strong>
                  {r.stationName ? <span className="text-sm text-zinc-500">· {r.stationName}</span> : null}
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">{r.count} {r.count === 1 ? "report" : "reports"}</span>
                </p>
                <p className="mt-1 text-sm text-zinc-700">{r.reasons.map((x) => REASON[x] ?? x).join(" · ")}</p>
                {r.details.map((d, i) => <p key={i} className="mt-1 text-sm italic text-zinc-600">“{d}”</p>)}
                <p className="mt-1 text-xs text-zinc-500">Last reported {new Date(r.lastAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={busy === r.targetId} onClick={() => void handle(r, "hide")} className="min-h-9 rounded-full bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
                    {HIDE[r.targetType]}
                  </button>
                  <button type="button" disabled={busy === r.targetId} onClick={() => void handle(r, "dismiss")} className="min-h-9 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 disabled:opacity-60">
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
