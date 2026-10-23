"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AuthControls from "../../AuthControls";
import { api, Card, Notice } from "../../lib/ui";

type Enquiry = {
  id: string;
  name: string;
  organisation: string | null;
  phone: string | null;
  email: string | null;
  message: string;
  status: "new" | "done";
  createdAt: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

/** Messages from the Advertise on Now On FM page. */
function Enquiries() {
  const [rows, setRows] = useState<Enquiry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Enquiry[]>("/admin/enquiries").then(setRows).catch((e) => setError(e instanceof Error ? e.message : "Could not load enquiries."));
  }, []);

  async function mark(row: Enquiry, status: "new" | "done") {
    try {
      await api(`/admin/enquiries/${row.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setRows((all) => (all ?? []).map((r) => (r.id === row.id ? { ...r, status } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update.");
    }
  }

  const open = (rows ?? []).filter((r) => r.status === "new").length;
  return (
    <Card title={`Advertiser enquiries${open ? ` · ${open} new` : ""}`}>
      {error ? <Notice kind="error" text={error} /> : null}
      {rows === null && !error ? (
        <p className="mt-2 text-sm text-zinc-500">Loading…</p>
      ) : rows && rows.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">No enquiries yet. They arrive from the Advertise on Now On FM page.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 text-sm">
          {(rows ?? []).map((r) => (
            <li key={r.id} className={`py-3 ${r.status === "done" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-zinc-900">
                  {r.name}
                  {r.organisation ? <span className="font-normal text-zinc-600"> · {r.organisation}</span> : null}
                </p>
                <span className="text-xs text-zinc-500">{when(r.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line text-zinc-700">{r.message}</p>
              <p className="mt-1 flex flex-wrap gap-x-4 text-zinc-600">
                {r.phone ? <a href={`tel:${r.phone}`} className="text-orange-700 underline">{r.phone}</a> : null}
                {r.email ? <a href={`mailto:${r.email}`} className="text-orange-700 underline">{r.email}</a> : null}
                <button type="button" onClick={() => void mark(r, r.status === "new" ? "done" : "new")} className="font-semibold text-zinc-700 hover:underline">
                  {r.status === "new" ? "Mark as replied" : "Mark as new"}
                </button>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: string | null;
  createdAt: string;
  details: Record<string, unknown> | null;
};

const actionText: Record<string, string> = {
  "rj.renamed": "RJ changed their name",
  "programme.renamed": "Programme renamed",
  "account.deleted": "Account deleted",
  "station.join_requested": "Station applied through an RJ's invite",
  "station.application_submitted": "Station applied directly",
  "affiliation.confirmed": "Station confirmed an RJ's dates",
  "affiliation.disputed": "Station disputed an RJ's dates",
  "station_rep.approved": "Station representative approved",
  "station_rep.rejected": "Station representative rejected",
  "claim.created": "Station claimed a programme",
  "claim.approved_by_rj": "RJ approved a claim",
  "claim.rejected_by_rj": "RJ declined a claim",
  "claim.approved_by_admin": "Super Admin approved a claim",
  "claim.rejected_by_admin": "Super Admin rejected a claim",
};

const filters = [
  { label: "All", keep: () => true },
  { label: "Name changes", keep: (a: AuditRow) => a.action === "rj.renamed" || a.action === "programme.renamed" },
  { label: "Deleted accounts", keep: (a: AuditRow) => a.action === "account.deleted" },
  { label: "Stations and claims", keep: (a: AuditRow) => /^(station|affiliation|claim)/.test(a.action) },
];

function detail(a: AuditRow): string | null {
  const d = a.details ?? {};
  if ((a.action === "rj.renamed" || a.action === "programme.renamed") && typeof d.from === "string" && typeof d.to === "string") {
    return `“${d.from}” → “${d.to}”`;
  }
  if (a.action === "account.deleted") {
    return Number(d.rjProfilesAnonymised) > 0 ? "Was an RJ: profile now shown as “Former RJ”" : "Listener account";
  }
  if (typeof d.reason === "string") return `“${d.reason}”`;
  return null;
}

/** Super Admin: everything recorded in the audit log, newest first. */
export default function AdminActivityPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(0);

  useEffect(() => {
    api<AuditRow[]>("/admin/audit-log?limit=200")
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load activity."));
  }, []);

  const shown = useMemo(() => (rows ?? []).filter(filters[filter].keep), [rows, filter]);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 hover:underline">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to NowRJ
          </Link>
          <AuthControls />
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-orange-700">Super Admin</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">Activity</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Advertiser enquiries and the last 200 recorded actions. Deleted accounts show no name, because deleting an account erases it.
        </p>


        <Enquiries />

        <h2 className="mt-8 text-lg font-bold text-zinc-900">Recorded actions</h2>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter activity">
          {filters.map((f, i) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={filter === i}
              onClick={() => setFilter(i)}
              className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${
                filter === i ? "border-orange-600 bg-orange-600 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-orange-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {error ? <div className="mt-4"><Notice kind="error" text={error} /></div> : null}

        <Card>
          {rows === null && !error ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-zinc-600">Nothing recorded yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {shown.map((a) => {
                const extra = detail(a);
                return (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                    <span className="text-zinc-900">
                      {actionText[a.action] ?? a.action}
                      {extra ? <span className="text-zinc-600"> · {extra}</span> : null}
                    </span>
                    <span className="text-zinc-500">
                      {a.action === "account.deleted" ? "" : `${a.actor ?? "System"} · `}
                      {new Date(a.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
