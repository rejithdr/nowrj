"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import AuthControls from "../../AuthControls";
import { api, Card, dangerButton, Notice, primaryButton, StatusPill } from "../../lib/ui";

type PendingRep = {
  roleId: string;
  createdAt: string;
  applicantName: string | null;
  applicantEmail: string | null;
  stationId: string;
  stationName: string;
  city: string | null;
  state: string | null;
  reach: string | null;
  stationStatus: string;
  contactPhone: string | null;
  contactEmail: string | null;
  invites: { rjName: string; invitedName: string }[] | null;
  waitingProgrammes: number;
};

type DisputedClaim = {
  id: string;
  programmeName: string;
  programmeSlug: string;
  stationName: string;
  rjName: string | null;
  rjReason: string | null;
};

type AuditRow = { id: string; action: string; actor: string | null; createdAt: string; details: Record<string, unknown> | null };

const actionText: Record<string, string> = {
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

export default function AdminStationsPage() {
  const [pending, setPending] = useState<PendingRep[]>([]);
  const [claims, setClaims] = useState<DisputedClaim[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, c, a] = await Promise.all([
        api<PendingRep[]>("/admin/station-reps/pending"),
        api<DisputedClaim[]>("/admin/claims"),
        api<AuditRow[]>("/admin/audit-log"),
      ]);
      setPending(p);
      setClaims(c);
      setAudit(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load. Are you signed in as a Super Admin?");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, path: string, confirmText: string, askReason: boolean, done: string) {
    let reason: string | null = null;
    if (askReason) {
      reason = window.prompt(`${confirmText}\n\nReason (shown to the people involved):`);
      if (reason === null) return;
    } else if (!window.confirm(confirmText)) {
      return;
    }
    setBusy(id);
    setError("");
    setMessage("");
    try {
      await api(path, { method: "POST", body: JSON.stringify({ reason }) });
      setMessage(done);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin/rjs" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 hover:underline">
            <ArrowLeft size={16} aria-hidden="true" />
            RJ management
          </Link>
          <AuthControls />
        </div>
        <h1 className="mt-3 text-3xl font-bold text-zinc-900">Stations and claims</h1>
        {error ? <Notice kind="error" text={error} /> : null}
        {message ? <Notice kind="ok" text={message} /> : null}

        <Card title={`Station applications (${pending.length})`}>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">Nothing waiting.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100">
              {pending.map((p) => (
                <li key={p.roleId} className="py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-zinc-900">{p.stationName}</h3>
                    {p.stationStatus === "pending" ? <StatusPill text="New station" tone="amber" /> : <StatusPill text="Already listed" tone="zinc" />}
                  </div>
                  <p className="mt-1 text-sm text-zinc-700">
                    {[p.city, p.state].filter(Boolean).join(", ") || "Location not given"}
                    {p.reach ? ` · ${p.reach}` : ""}
                  </p>
                  {p.stationStatus === "pending" ? (
                    <p className="text-sm text-zinc-700">Station contact: {[p.contactPhone, p.contactEmail].filter(Boolean).join(" · ") || "—"}</p>
                  ) : null}
                  <p className="text-sm text-zinc-700">Applicant: {p.applicantName ?? "Unknown"}{p.applicantEmail ? ` (${p.applicantEmail})` : ""}</p>
                  <p className="text-sm text-zinc-600">
                    Invited by {p.invites?.map((i) => i.rjName).join(", ") || "—"}
                    {p.waitingProgrammes ? ` · ${p.waitingProgrammes} programme(s) waiting for this station` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy === p.roleId}
                      onClick={() => void act(p.roleId, `/admin/station-reps/${p.roleId}/approve`, `Approve ${p.applicantName ?? "this person"} as representative of ${p.stationName}?${p.stationStatus === "pending" ? " The station will become visible to listeners." : ""}`, false, `${p.stationName} approved.`)}
                      className={primaryButton}
                    >
                      <Check size={16} aria-hidden="true" /> Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy === p.roleId}
                      onClick={() => void act(p.roleId, `/admin/station-reps/${p.roleId}/reject`, `Reject this application for ${p.stationName}?`, true, "Application rejected. The RJ's invite link can be used again.")}
                      className={dangerButton}
                    >
                      <X size={16} aria-hidden="true" /> Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Claims declined by RJs (${claims.length})`}>
          <p className="mt-1 text-sm text-zinc-600">A station claimed a programme and the RJ declined. You decide who owns it.</p>
          {claims.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">Nothing waiting.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100">
              {claims.map((c) => (
                <li key={c.id} className="py-4">
                  <p className="font-bold text-zinc-900">
                    <Link href={`/programme/${c.programmeSlug}`} className="hover:text-orange-700">{c.programmeName}</Link>
                  </p>
                  <p className="text-sm text-zinc-700">{c.stationName} wants it · owned by {c.rjName ?? "an RJ"}</p>
                  <p className="mt-1 rounded-lg bg-zinc-50 p-2 text-sm text-zinc-700">RJ&apos;s reason: {c.rjReason ?? "—"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={busy === c.id} onClick={() => void act(c.id, `/admin/claims/${c.id}/approve`, `Give ${c.programmeName} to ${c.stationName}?`, true, "Claim approved. The station now owns the programme.")} className={primaryButton}>
                      <Check size={16} aria-hidden="true" /> Give to station
                    </button>
                    <button type="button" disabled={busy === c.id} onClick={() => void act(c.id, `/admin/claims/${c.id}/reject`, `Keep ${c.programmeName} with the RJ?`, true, "Claim rejected. The RJ keeps the programme.")} className={dangerButton}>
                      <X size={16} aria-hidden="true" /> Keep with RJ
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent activity">
          {audit.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">No activity yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="text-zinc-900">
                    {actionText[a.action] ?? a.action}
                    {typeof a.details?.reason === "string" ? <span className="text-zinc-600"> · “{a.details.reason}”</span> : null}
                  </span>
                  <span className="text-zinc-500">
                    {a.actor ?? "System"} · {new Date(a.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
