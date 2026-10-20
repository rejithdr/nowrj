"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, Notice, StatusPill } from "./ui";

type StationRj = {
  id: string;
  name: string;
  slug: string;
  rjStatus: string;
  joinedOn: string;
  leftOn: string | null;
  verificationStatus: string;
  stationNote: string | null;
};

const date = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** RJs who say they work or worked at this station; the station confirms or disputes each period. */
export default function StationRjs({ stationId }: { stationId: string }) {
  const [rows, setRows] = useState<StationRj[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api<StationRj[]>(`/station-reps/me/stations/${stationId}/rjs`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load RJs.");
    }
  }, [stationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(row: StationRj, confirm: boolean) {
    let body: string | undefined;
    if (!confirm) {
      const note = window.prompt(`What is wrong with ${row.name}'s time at your station? They will see your note.`);
      if (!note) return;
      body = JSON.stringify({ note });
    } else if (!window.confirm(`Confirm that ${row.name} worked at your station from ${date(row.joinedOn)}${row.leftOn ? ` to ${date(row.leftOn)}` : ""}?`)) {
      return;
    }
    setBusy(row.id);
    setError("");
    try {
      await api(`/station-reps/me/stations/${stationId}/affiliations/${row.id}/${confirm ? "confirm" : "dispute"}`, { method: "POST", body });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <Notice kind="error" text={error} />;
  if (!rows) return <p className="mt-2 text-sm text-zinc-500">Loading…</p>;
  if (rows.length === 0) return <p className="mt-2 text-sm text-zinc-600">No RJs have listed your station yet.</p>;

  return (
    <ul className="mt-3 divide-y divide-zinc-100">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
          <div>
            {["verified", "legacy"].includes(row.rjStatus) ? (
              <Link href={`/rj/${row.slug}`} className="font-semibold text-zinc-900 hover:text-orange-700">{row.name}</Link>
            ) : (
              <p className="font-semibold text-zinc-900">{row.name}</p>
            )}
            <p className="text-sm text-zinc-600">{date(row.joinedOn)} – {row.leftOn ? date(row.leftOn) : "present"}</p>
            {row.stationNote ? <p className="text-xs text-zinc-500">Your note: “{row.stationNote}”</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {row.verificationStatus === "verified" ? (
              <StatusPill text="Confirmed" tone="green" />
            ) : row.verificationStatus === "disputed" ? (
              <StatusPill text="Disputed" tone="red" />
            ) : (
              <StatusPill text="Needs your review" tone="amber" />
            )}
            {row.verificationStatus !== "verified" ? (
              <button type="button" disabled={busy === row.id} onClick={() => void decide(row, true)} className="text-sm font-semibold text-emerald-700 hover:underline">Confirm</button>
            ) : null}
            {row.verificationStatus !== "disputed" ? (
              <button type="button" disabled={busy === row.id} onClick={() => void decide(row, false)} className="text-sm font-semibold text-red-700 hover:underline">Dispute</button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
