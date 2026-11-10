"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import AuthControls from "../../AuthControls";
import { api, Card, inputClass, labelClass, Notice, primaryButton, quietButton, StatusPill } from "../../lib/ui";

type Org = { id: string; name: string; kind: "network" | "standalone"; stationCount: number; staffCount: number; openInvites: number };
type StationRow = { id: string; name: string; city: string | null; organisationId: string | null; organisationKind: string | null };
type Unit = { id: string; kind: string; name: string };

/** Super Admin: networks, and moving stations into them. */
export default function AdminOrganisationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [name, setName] = useState("");
  const [move, setMove] = useState({ organisationId: "", stationId: "", parentUnitId: "" });
  const [regions, setRegions] = useState<Unit[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api<{ organisations: Org[]; stations: StationRow[] }>("/admin/orgs");
    setOrgs(data.organisations);
    setStations(data.stations);
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
