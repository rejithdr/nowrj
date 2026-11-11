"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import AuthControls from "../../AuthControls";
import { api, Card, inputClass, labelClass, Notice, primaryButton, quietButton, StatusPill } from "../../lib/ui";

type Org = { id: string; name: string; kind: "network" | "standalone"; stationCount: number; staffCount: number; openInvites: number };
type StationRow = { id: string; name: string; city: string | null; organisationId: string | null; organisationKind: string | null };
type Unit = { id: string; kind: string; name: string };
type InviteApproval = { id: string; email: string; organisationName: string; designationName: string; place: string; invitedBy: string | null; inviterDesignation: string | null };
type StationRequest = { id: string; name: string; city: string | null; contactPhone: string | null; contactEmail: string | null; organisationName: string; regionName: string | null; requestedBy: string | null };

/** Super Admin: networks, and moving stations into them. */
export default function AdminOrganisationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [name, setName] = useState("");
  const [move, setMove] = useState({ organisationId: "", stationId: "", parentUnitId: "" });
  const [regions, setRegions] = useState<Unit[]>([]);
  const [requests, setRequests] = useState<StationRequest[]>([]);
  const [approvals, setApprovals] = useState<InviteApproval[]>([]);
  const [single, setSingle] = useState({ name: "", city: "", email: "" });
  const [singleLink, setSingleLink] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api<{ organisations: Org[]; stations: StationRow[] }>("/admin/orgs");
    setOrgs(data.organisations);
    setStations(data.stations);
    setRequests(await api<StationRequest[]>("/admin/orgs/station-requests"));
    setApprovals(await api<InviteApproval[]>("/admin/orgs/invite-approvals"));
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load organisations."));
  }, [load]);

  useEffect(() => {
    if (!move.organisationId) return setRegions([]);
    api<{ units: Unit[] }>(`/orgs/${move.organisationId}`)
      .then((d) => setRegions(d.units.filter((u) => u.kind === "region")))
      .catch(() => setRegions([]));
  }, [move.organisationId]);

  async function act(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(done);
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (await act(() => api("/admin/orgs", { method: "POST", body: JSON.stringify({ name }) }), `Network “${name.trim()}” created. Open it to add regions and invite its head-office admin.`)) setName("");
  }

  async function moveStation(e: FormEvent) {
    e.preventDefault();
    const station = stations.find((s) => s.id === move.stationId);
    const org = orgs.find((o) => o.id === move.organisationId);
    if (!window.confirm(`Move ${station?.name} into ${org?.name}? Its current staff join the network at that station.`)) return;
    if (
      await act(
        () => api(`/admin/orgs/${move.organisationId}/stations`, { method: "POST", body: JSON.stringify({ stationId: move.stationId, parentUnitId: move.parentUnitId || null }) }),
        `${station?.name} moved into ${org?.name}.`,
      )
    ) setMove({ ...move, stationId: "", parentUnitId: "" });
  }

  const networks = orgs.filter((o) => o.kind === "network");
  const movable = stations.filter((s) => s.organisationKind !== "network");

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 hover:underline">
            <ArrowLeft size={16} aria-hidden="true" /> Back to NowRJ
          </Link>
          <AuthControls />
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-orange-700">Super Admin</p>
        <h1 className="text-2xl font-bold text-zinc-900">Organisations</h1>
        <p className="mt-1 text-sm text-zinc-600">Each station starts as its own organisation. A network (head office, regions and stations) is created here.</p>
        {message ? <Notice kind="ok" text={message} /> : null}
        {error ? <Notice kind="error" text={error} /> : null}

        {approvals.length ? (
          <Card title="Invites to a higher post">
            <p className="text-sm text-zinc-600">Someone invited a person to a post above their own. The invite link works only after you approve it.</p>
            <ul className="mt-2 divide-y divide-zinc-100">
              {approvals.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900">{a.email}</p>
                    <p className="text-sm text-zinc-600">{a.designationName} · {a.place} · {a.organisationName}</p>
                    <p className="text-xs text-zinc-500">Invited by {a.invitedBy ?? "—"}{a.inviterDesignation ? ` (${a.inviterDesignation})` : ""}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} className={primaryButton} onClick={() => void act(() => api(`/admin/orgs/invite-approvals/${a.id}/approve`, { method: "POST" }), `Invite for ${a.email} approved.`)}>Approve</button>
                    <button type="button" disabled={busy} className={quietButton} onClick={() => void act(() => api(`/admin/orgs/invite-approvals/${a.id}/reject`, { method: "POST" }), `Invite for ${a.email} rejected.`)}>Reject</button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {requests.length ? (
          <Card title="New stations from networks">
            <ul className="mt-2 divide-y divide-zinc-100">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900">{r.name}{r.city ? ` · ${r.city}` : ""}</p>
                    <p className="text-sm text-zinc-600">{r.organisationName}{r.regionName ? ` · ${r.regionName}` : " · Head office"} · asked by {r.requestedBy ?? "—"}</p>
                    <p className="text-xs text-zinc-500">{[r.contactPhone, r.contactEmail].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} className={primaryButton} onClick={() => void act(() => api(`/admin/orgs/station-requests/${r.id}/approve`, { method: "POST" }), `${r.name} approved.`)}>Approve</button>
                    <button
                      type="button"
                      disabled={busy}
                      className={quietButton}
                      onClick={() => {
                        const reason = window.prompt(`Why is ${r.name} not approved?`);
                        if (reason) void act(() => api(`/admin/orgs/station-requests/${r.id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }), `${r.name} not approved.`);
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card title="Set up a single station">
          <p className="text-sm text-zinc-600">Creates the station and an invite for its Station admin. Send them the link.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSingleLink("");
              let token = "";
              const ok = await act(async () => {
                token = (await api<{ token: string }>("/admin/orgs/standalone", { method: "POST", body: JSON.stringify(single) })).token;
              }, `${single.name.trim()} created.`);
              if (ok) {
                setSingleLink(`${window.location.origin}/org-invite/${token}`);
                setSingle({ name: "", city: "", email: "" });
              }
            }}
            className="mt-2 grid gap-3 sm:grid-cols-3"
          >
            <div>
              <label htmlFor="ss-name" className={labelClass}>Station name</label>
              <input id="ss-name" required maxLength={150} value={single.name} onChange={(e) => setSingle({ ...single, name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ss-city" className={labelClass}>City</label>
              <input id="ss-city" maxLength={100} value={single.city} onChange={(e) => setSingle({ ...single, city: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ss-email" className={labelClass}>Station admin&apos;s email</label>
              <input id="ss-email" type="email" required maxLength={255} value={single.email} onChange={(e) => setSingle({ ...single, email: e.target.value })} className={inputClass} />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" disabled={busy} className={primaryButton}><Plus size={16} aria-hidden="true" /> Create station and invite</button>
            </div>
          </form>
          {singleLink ? (
            <p className="mt-3 break-all rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
              Invite link (only works for that email): <span className="font-mono">{singleLink}</span>
            </p>
          ) : null}
        </Card>

        <Card title="Create a network">
          <form onSubmit={create} className="mt-2 flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label htmlFor="net-name" className={labelClass}>Network name</label>
              <input id="net-name" required maxLength={150} placeholder="Suryan FM" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <button type="submit" disabled={busy} className={primaryButton}><Plus size={16} aria-hidden="true" /> Create</button>
          </form>
        </Card>

        {networks.length ? (
          <Card title="Move a station into a network">
            <form onSubmit={moveStation} className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="mv-net" className={labelClass}>Network</label>
                <select id="mv-net" required value={move.organisationId} onChange={(e) => setMove({ organisationId: e.target.value, stationId: move.stationId, parentUnitId: "" })} className={inputClass}>
                  <option value="" disabled>Choose…</option>
                  {networks.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="mv-station" className={labelClass}>Station</label>
                <select id="mv-station" required value={move.stationId} onChange={(e) => setMove({ ...move, stationId: e.target.value })} className={inputClass}>
                  <option value="" disabled>Choose…</option>
                  {movable.map((s) => <option key={s.id} value={s.id}>{s.name}{s.city ? ` · ${s.city}` : ""}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="mv-region" className={labelClass}>Under</label>
                <select id="mv-region" value={move.parentUnitId} onChange={(e) => setMove({ ...move, parentUnitId: e.target.value })} className={inputClass}>
                  <option value="">Head office</option>
                  {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={busy} className={primaryButton}>Move station</button>
              </div>
            </form>
          </Card>
        ) : null}

        <Card title="All organisations">
          <ul className="mt-2 divide-y divide-zinc-100">
            {orgs.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold text-zinc-900">{o.name}</p>
                  <p className="text-sm text-zinc-600">
                    {o.stationCount} station{o.stationCount === 1 ? "" : "s"} · {o.staffCount} staff{o.openInvites ? ` · ${o.openInvites} open invite${o.openInvites === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill text={o.kind === "network" ? "Network" : "Single station"} tone={o.kind === "network" ? "green" : "zinc"} />
                  <Link href={`/org?id=${o.id}`} className={quietButton}>Open</Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
