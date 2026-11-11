"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Copy, LoaderCircle, MessageCircle, Plus, Trash2, X } from "lucide-react";
import { api, Card, dangerButton, inputClass, labelClass, Notice, primaryButton, quietButton, StatusPill } from "./ui";

export type Level = "none" | "view" | "edit" | "authorise";
export const AREAS = ["programmes", "rjs", "adsSponsored", "adsShoutout", "adsAired", "stats"] as const;
export type Area = (typeof AREAS)[number];
export const AREA_LABEL: Record<Area, string> = {
  programmes: "Programmes",
  rjs: "RJs",
  adsSponsored: "Ads – Sponsored",
  adsShoutout: "Ads – Shout-out",
  adsAired: "Ads – Aired spots",
  stats: "Stats",
};
const LEVEL_LABEL: Record<Level, string> = { none: "None", view: "View", edit: "Edit", authorise: "Authorise" };
const levelsFor = (area: Area): Level[] => (area === "stats" ? ["none", "view"] : ["none", "view", "edit", "authorise"]);

type Unit = { id: string; parentId: string | null; kind: "region" | "station"; name: string; stationId: string | null; stationSlug: string | null; stationStatus: string | null; hidden: boolean; inScope: boolean };
type Designation = Record<Area, Level> & { id: string; name: string; rank: number; manageStaff: boolean; memberCount: number };
type Member = { id: string; listenerId: string; name: string | null; email: string | null; unitId: string | null; designationId: string; inScope: boolean; isMe: boolean };
type Invite = { id: string; email: string; unitId: string | null; designationId: string; token: string | null; status: "sent" | "awaiting_approval"; expiresAt: string; expired: boolean };
type Overview = {
  organisation: { id: string; name: string; kind: "network" | "standalone"; hidden: boolean };
  me: { superadmin: boolean; memberId: string | null; wholeOrg: boolean; scopeUnitId: string | null; rank: number };
  units: Unit[];
  designations: Designation[];
  members: Member[];
  invites: Invite[];
};

/** Units in tree order, each with its depth. */
function treeOrder(units: Unit[]) {
  const out: (Unit & { depth: number })[] = [];
  const walk = (parentId: string | null, depth: number) => {
    units
      .filter((u) => u.parentId === parentId)
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "region" ? -1 : 1))
      .forEach((u) => {
        out.push({ ...u, depth });
        walk(u.id, depth + 1);
      });
  };
  walk(null, 0);
  return out;
}

function inviteLink(token: string) {
  return `${typeof window === "undefined" ? "" : window.location.origin}/org-invite/${token}`;
}

/** Structure, designations, staff and invites for one organisation. */
export default function OrgManager({ organisationId }: { organisationId: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setData(await api<Overview>(`/orgs/${organisationId}`));
  }, [organisationId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load the organisation."));
  }, [load]);

  async function run(key: string, action: () => Promise<unknown>, done?: string) {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      await action();
      if (done) setMessage(done);
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (!data) return error ? <Notice kind="error" text={error} /> : <p className="mt-6 text-zinc-600"><LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />Loading…</p>;

  const { organisation, me } = data;
  const network = organisation.kind === "network";
  const placeName = (unitId: string | null) =>
    unitId ? data.units.find((u) => u.id === unitId)?.name ?? "—" : network ? "Head office" : organisation.name;
  const scopeText = me.wholeOrg ? (network ? "the whole network" : organisation.name) : placeName(me.scopeUnitId);

  return (
    <div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-zinc-900">{organisation.name}</h1>
          <div className="flex gap-2">
            {organisation.hidden ? <StatusPill text="Hidden from listeners" tone="red" /> : null}
            <StatusPill text={network ? "Network" : "Single station"} tone="zinc" />
          </div>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          {me.superadmin && !me.memberId ? "You are viewing this as Super Admin." : `You manage staff for ${scopeText}.`}
        </p>
        {message ? <Notice kind="ok" text={message} /> : null}
        {error ? <Notice kind="error" text={error} /> : null}
      </Card>

      {network ? <Structure data={data} busy={busy} run={run} /> : null}
      <Designations data={data} busy={busy} run={run} />
      <Staff data={data} busy={busy} run={run} placeName={placeName} />
    </div>
  );
}

type Run = (key: string, action: () => Promise<unknown>, done?: string) => Promise<boolean>;
type SectionProps = { data: Overview; busy: string | null; run: Run };

// ------------------------------------------------------------------ structure

function Structure({ data, busy, run }: SectionProps) {
  const base = `/orgs/${data.organisation.id}`;
  const rows = useMemo(() => treeOrder(data.units), [data.units]);
  const regions = rows.filter((u) => u.kind === "region");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [station, setStation] = useState({ name: "", city: "", parentId: data.me.wholeOrg ? "" : data.me.scopeUnitId ?? "", contactPhone: "" });
  const canEdit = data.me.wholeOrg;
  const myRegion = data.units.find((u) => u.id === data.me.scopeUnitId && u.kind === "region");
  const canAddStation = canEdit || Boolean(myRegion);
  const stationParents = canEdit ? regions : regions.filter((r) => r.inScope);

  async function addStation(e: FormEvent) {
    e.preventDefault();
    const ok = await run(
      "station",
      () => api(`${base}/stations`, { method: "POST", body: JSON.stringify({ ...station, parentId: station.parentId || null, contactPhone: station.contactPhone || undefined }) }),
      `${station.name.trim()} added. It shows to listeners once the NowRJ team approves it; you can invite its staff now.`,
    );
    if (ok) setStation({ name: "", city: "", parentId: canEdit ? "" : myRegion?.id ?? "", contactPhone: "" });
  }

  async function addRegion(e: FormEvent) {
    e.preventDefault();
    const ok = await run("region", () => api(`${base}/regions`, { method: "POST", body: JSON.stringify({ name, parentId: parentId || null }) }), `Region “${name.trim()}” added.`);
    if (ok) {
      setName("");
      setParentId("");
    }
  }

  return (
    <Card title="Regions and stations">
      <p className="text-sm text-zinc-600">Staff placed at a region can work on every station under it. Staff at the head office cover the whole network.</p>
      <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
        <li className="p-3 font-semibold text-zinc-900">Head office</li>
        {rows.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 p-3" style={{ paddingLeft: `${0.75 + (u.depth + 1) * 1.25}rem` }}>
            <div className="min-w-0">
              {renaming?.id === u.id ? (
                <div className="flex flex-wrap gap-2">
                  <input aria-label="Region name" maxLength={150} value={renaming.name} onChange={(e) => setRenaming({ id: u.id, name: e.target.value })} className={`${inputClass} max-w-56`} />
                  <button type="button" className={quietButton} disabled={busy !== null} onClick={() => void run(`rename-${u.id}`, () => api(`${base}/units/${u.id}`, { method: "PATCH", body: JSON.stringify({ name: renaming.name }) }), "Region renamed.").then((ok) => ok && setRenaming(null))}>
                    <Check size={14} aria-hidden="true" /> Save
                  </button>
                  <button type="button" className={quietButton} onClick={() => setRenaming(null)}><X size={14} aria-hidden="true" /> Cancel</button>
                </div>
              ) : (
                <p className="font-medium text-zinc-900">
                  {u.kind === "station" && u.stationSlug ? <Link href={`/station/${u.stationSlug}`} className="hover:text-orange-700">{u.name}</Link> : u.name}
                  <span className="ml-2 text-xs font-normal uppercase tracking-wide text-zinc-500">{u.kind}</span>
                  {u.stationStatus === "pending" ? <span className="ml-2 text-xs font-semibold text-amber-700">Awaiting NowRJ approval</span> : null}
                  {u.hidden ? <span className="ml-2 text-xs font-semibold text-red-700">Hidden from listeners</span> : null}
                </p>
              )}
            </div>
            {canEdit && renaming?.id !== u.id ? (
              <div className="flex flex-wrap items-center gap-2">
                {data.me.superadmin ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    className={`text-sm font-semibold hover:underline ${u.hidden ? "text-green-700" : "text-red-700"}`}
                    onClick={() =>
                      void run(
                        `vis-${u.id}`,
                        () => api(`/admin/orgs/${data.organisation.id}/units/${u.id}/visibility`, { method: "POST", body: JSON.stringify({ hidden: !u.hidden }) }),
                        u.hidden ? `${u.name} is visible to listeners again.` : `${u.name} is hidden from listeners${u.kind === "region" ? ", with every station under it" : ""}.`,
                      )
                    }
                  >
                    {u.hidden ? "Show to listeners" : "Hide"}
                  </button>
                ) : null}
                <label className="sr-only" htmlFor={`parent-${u.id}`}>Move {u.name} under</label>
                <select
                  id={`parent-${u.id}`}
                  value={u.parentId ?? ""}
                  disabled={busy !== null}
                  onChange={(e) => void run(`move-${u.id}`, () => api(`${base}/units/${u.id}`, { method: "PATCH", body: JSON.stringify({ parentId: e.target.value || null }) }), `${u.name} moved.`)}
                  className="min-h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm"
                >
                  <option value="">Under head office</option>
                  {regions.filter((r) => r.id !== u.id).map((r) => (
                    <option key={r.id} value={r.id}>Under {r.name}</option>
                  ))}
                </select>
                {u.kind === "region" ? (
                  <>
                    <button type="button" className="text-sm font-semibold text-orange-700 hover:underline" onClick={() => setRenaming({ id: u.id, name: u.name })}>Rename</button>
                    <button
                      type="button"
                      className="text-sm font-semibold text-red-700 hover:underline"
                      disabled={busy !== null}
                      onClick={() => window.confirm(`Remove the region ${u.name}?`) && void run(`del-${u.id}`, () => api(`${base}/units/${u.id}`, { method: "DELETE" }), "Region removed.")}
                    >
                      Remove
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form onSubmit={addRegion} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="region-name" className={labelClass}>New region</label>
            <input id="region-name" required maxLength={150} placeholder="Kerala" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="region-parent" className={labelClass}>Sits under</label>
            <select id="region-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputClass}>
              <option value="">Head office</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy === "region"} className={primaryButton}><Plus size={16} aria-hidden="true" /> Add region</button>
        </form>
      ) : null}
      {canAddStation ? (
        <form onSubmit={addStation} className="mt-6 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2">
          <h3 className="font-bold text-zinc-900 sm:col-span-2">Add a station</h3>
          <div>
            <label htmlFor="st-name" className={labelClass}>Station name</label>
            <input id="st-name" required maxLength={150} placeholder="Midas FM Kochi" value={station.name} onChange={(e) => setStation({ ...station, name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="st-city" className={labelClass}>City</label>
            <input id="st-city" maxLength={100} value={station.city} onChange={(e) => setStation({ ...station, city: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="st-parent" className={labelClass}>Sits under</label>
            <select id="st-parent" value={station.parentId} onChange={(e) => setStation({ ...station, parentId: e.target.value })} className={inputClass}>
              {canEdit ? <option value="">Head office</option> : null}
              {stationParents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="st-phone" className={labelClass}>Phone for the NowRJ team (optional)</label>
            <input id="st-phone" type="tel" maxLength={20} value={station.contactPhone} onChange={(e) => setStation({ ...station, contactPhone: e.target.value })} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy === "station"} className={primaryButton}><Plus size={16} aria-hidden="true" /> Add station</button>
            <p className="mt-2 text-xs text-zinc-500">The NowRJ team checks each new station before listeners can see it.</p>
          </div>
        </form>
      ) : null}
    </Card>
  );
}

// --------------------------------------------------------------- designations

type DesignationForm = Record<Area, Level> & { name: string; manageStaff: boolean };
const emptyForm = (): DesignationForm => ({ name: "", manageStaff: false, ...(Object.fromEntries(AREAS.map((a) => [a, "none"])) as Record<Area, Level>) });

function LevelPicker({ form, setForm, idPrefix }: { form: DesignationForm; setForm: (f: DesignationForm) => void; idPrefix: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {AREAS.map((area) => (
        <div key={area} className="flex items-center justify-between gap-2">
          <label htmlFor={`${idPrefix}-${area}`} className="text-sm text-zinc-700">{AREA_LABEL[area]}</label>
          <select id={`${idPrefix}-${area}`} value={form[area]} onChange={(e) => setForm({ ...form, [area]: e.target.value as Level })} className="min-h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm">
            {levelsFor(area).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
        </div>
      ))}
      <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
        <input type="checkbox" checked={form.manageStaff} onChange={(e) => setForm({ ...form, manageStaff: e.target.checked })} className="h-4 w-4 accent-orange-600" />
        Can invite, move and remove staff in their part of the organisation
      </label>
    </div>
  );
}

function Designations({ data, busy, run }: SectionProps) {
  const base = `/orgs/${data.organisation.id}`;
  const canEdit = data.me.wholeOrg;
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<DesignationForm>(emptyForm());
  const [adding, setAdding] = useState(false);
  /** Only posts below your own can be edited, removed or reordered. */
  const below = (d: Designation) => data.me.superadmin || d.rank > data.me.rank;
  const order = data.designations.map((d) => d.id);

  function move(index: number, by: -1 | 1) {
    const next = [...order];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    void run("order", () => api(`${base}/designations/order`, { method: "POST", body: JSON.stringify({ ids: next }) }), "Order of posts saved.");
  }

  function startEdit(d: Designation) {
    setAdding(false);
    setEditing(d.id);
    setForm({ name: d.name, manageStaff: d.manageStaff, ...(Object.fromEntries(AREAS.map((a) => [a, d[a]])) as Record<Area, Level>) });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const ok = editing
      ? await run("designation", () => api(`${base}/designations/${editing}`, { method: "PATCH", body: JSON.stringify(form) }), "Designation saved.")
      : await run("designation", () => api(`${base}/designations`, { method: "POST", body: JSON.stringify(form) }), `Designation “${form.name.trim()}” added.`);
    if (ok) {
      setEditing(null);
      setAdding(false);
      setForm(emptyForm());
    }
  }

  const editor = (
    <form onSubmit={save} className="mt-3 space-y-3 rounded-xl bg-zinc-50 p-4">
      <div>
        <label htmlFor="d-name" className={labelClass}>Designation name</label>
        <input id="d-name" required maxLength={80} placeholder="Programme producer" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
      </div>
      <LevelPicker form={form} setForm={setForm} idPrefix="d" />
      <p className="text-xs text-zinc-500">Authorise includes Edit, and Edit includes View.</p>
      <div className="flex gap-2">
        <button type="submit" disabled={busy === "designation"} className={primaryButton}>
          {busy === "designation" ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} Save
        </button>
        <button type="button" className={quietButton} onClick={() => { setEditing(null); setAdding(false); setForm(emptyForm()); }}>Cancel</button>
      </div>
    </form>
  );

  return (
    <Card title="Designations">
      <p className="text-sm text-zinc-600">
        Posts are listed highest first. Staff can change or remove only people in a lower post than their own, and an invite to a higher post waits for the NowRJ team&apos;s approval.
      </p>
      <ul className="mt-3 space-y-3">
        {data.designations.map((d, i) => (
          <li key={d.id} className="rounded-xl border border-zinc-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-zinc-900">
                <span className="mr-2 text-xs font-normal text-zinc-500">{i + 1}.</span>
                {d.name}
                <span className="ml-2 text-xs font-normal text-zinc-500">{d.memberCount} staff</span>
              </p>
              {canEdit && editing !== d.id ? (
                <div className="flex items-center gap-3">
                  {below(d) ? (
                    <>
                      <button type="button" aria-label={`Move ${d.name} up`} disabled={busy !== null || i === 0 || !below(data.designations[i - 1])} onClick={() => move(i, -1)} className="rounded p-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30">
                        <ArrowUp size={16} aria-hidden="true" />
                      </button>
                      <button type="button" aria-label={`Move ${d.name} down`} disabled={busy !== null || i === data.designations.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30">
                        <ArrowDown size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="text-sm font-semibold text-orange-700 hover:underline" onClick={() => startEdit(d)}>Edit</button>
                    </>
                  ) : (
                    <span className="text-xs text-zinc-500">Your post or above</span>
                  )}
                  {d.memberCount === 0 && below(d) ? (
                    <button type="button" className="text-sm font-semibold text-red-700 hover:underline" disabled={busy !== null} onClick={() => window.confirm(`Remove the designation ${d.name}?`) && void run(`d-del-${d.id}`, () => api(`${base}/designations/${d.id}`, { method: "DELETE" }), "Designation removed.")}>
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {editing === d.id ? (
              editor
            ) : (
              <p className="mt-1 text-sm text-zinc-600">
                {AREAS.filter((a) => d[a] !== "none").map((a) => `${AREA_LABEL[a]}: ${LEVEL_LABEL[d[a]]}`).join(" · ") || "No access yet"}
                {d.manageStaff ? " · Manages staff" : ""}
              </p>
            )}
          </li>
        ))}
      </ul>
      {canEdit ? (
        adding ? editor : (
          <button type="button" className={`${quietButton} mt-4`} onClick={() => { setEditing(null); setForm(emptyForm()); setAdding(true); }}>
            <Plus size={14} aria-hidden="true" /> Add a designation
          </button>
        )
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------- staff

function Staff({ data, busy, run, placeName }: SectionProps & { placeName: (unitId: string | null) => string }) {
  const base = `/orgs/${data.organisation.id}`;
  const network = data.organisation.kind === "network";
  const places = useMemo(() => {
    const ordered = treeOrder(data.units).filter((u) => u.inScope);
    // Indent below the top of this person's part of the organisation.
    const top = data.me.wholeOrg || !ordered.length ? 0 : Math.min(...ordered.map((u) => u.depth));
    return [
      ...(data.me.wholeOrg ? [{ id: "", label: network ? "Head office (whole network)" : data.organisation.name }] : []),
      ...(network ? ordered.map((u) => ({ id: u.id, label: `${"— ".repeat(Math.max(0, u.depth - top))}${u.name}` })) : []),
    ];
  }, [data, network]);
  const designationName = (id: string) => data.designations.find((d) => d.id === id)?.name ?? "—";
  const higher = (d: Designation) => !data.me.superadmin && d.rank < data.me.rank;
  /** Ordinary staff only at your own place; for places under you, only their admins. */
  const ownPlace = data.me.scopeUnitId ?? "";
  const allowedAt = (placeId: string, d: Designation) => data.me.superadmin || placeId === ownPlace || d.manageStaff;
  const inviteOption = (d: Designation) => (
    <option key={d.id} value={d.id}>{d.name}{higher(d) ? " (needs NowRJ approval)" : ""}</option>
  );
  // Giving someone a post at or above your own is for the NowRJ team.
  const changeOption = (d: Designation, current: string, placeId: string) => (
    <option key={d.id} value={d.id} disabled={d.id !== current && ((!data.me.superadmin && d.rank <= data.me.rank) || !allowedAt(placeId, d))}>{d.name}</option>
  );
  const rankOf = (id: string) => data.designations.find((d) => d.id === id)?.rank ?? Number.MAX_SAFE_INTEGER;
  const [invite, setInvite] = useState({ email: "", unitId: places[0]?.id ?? "", designationId: "" });
  const [changes, setChanges] = useState<Record<string, { unitId: string; designationId: string }>>({});
  const [copied, setCopied] = useState<string | null>(null);

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    const ok = await run(
      "invite",
      () => api(`${base}/invites`, { method: "POST", body: JSON.stringify({ email: invite.email, unitId: invite.unitId || null, designationId: invite.designationId }) }),
      higher(data.designations.find((d) => d.id === invite.designationId)!)
        ? `Invite for ${invite.email.trim()} is waiting for approval by the NowRJ team, because the post is above your own. The link appears below once approved.`
        : `Invite created for ${invite.email.trim()}. Copy the link below and send it to them.`,
    );
    if (ok) setInvite({ ...invite, email: "" });
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copy this link:", inviteLink(token));
    }
  }

  return (
    <Card title="Staff">
      <ul className="divide-y divide-zinc-100">
        {data.members.map((m) => {
          const change = changes[m.id] ?? { unitId: m.unitId ?? "", designationId: m.designationId };
          const changed = change.unitId !== (m.unitId ?? "") || change.designationId !== m.designationId;
          // Only people in a lower post than yours, inside your part of the organisation.
          const post = data.designations.find((d) => d.id === m.designationId);
          const editable =
            m.inScope &&
            (data.me.superadmin || (!m.isMe && rankOf(m.designationId) > data.me.rank && Boolean(post) && allowedAt(m.unitId ?? "", post!)));
          return (
            <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900">{m.name ?? "Unnamed"}{m.isMe ? <span className="ml-2 text-xs font-normal text-zinc-500">you</span> : null}</p>
                <p className="truncate text-sm text-zinc-600">{m.email}</p>
                <p className="text-sm text-zinc-600">{designationName(m.designationId)} · {placeName(m.unitId)}</p>
              </div>
              {editable ? (
                <div className="flex flex-wrap items-center gap-2">
                  {network ? (
                    <select aria-label={`Place for ${m.name}`} value={change.unitId} onChange={(e) => setChanges({ ...changes, [m.id]: { ...change, unitId: e.target.value } })} className="min-h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm">
                      {places.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  ) : null}
                  <select aria-label={`Designation for ${m.name}`} value={change.designationId} onChange={(e) => setChanges({ ...changes, [m.id]: { ...change, designationId: e.target.value } })} className="min-h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm">
                    {data.designations.map((d) => changeOption(d, m.designationId, change.unitId))}
                  </select>
                  {changed ? (
                    <button
                      type="button"
                      className={quietButton}
                      disabled={busy !== null}
                      onClick={() =>
                        void run(`m-${m.id}`, () => api(`${base}/members/${m.id}`, { method: "PATCH", body: JSON.stringify({ unitId: change.unitId || null, designationId: change.designationId }) }), `${m.name ?? "Staff member"} updated.`).then((ok) => {
                          if (ok) setChanges(({ [m.id]: _, ...rest }) => rest);
                        })
                      }
                    >
                      <Check size={14} aria-hidden="true" /> Save
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={dangerButton}
                    disabled={busy !== null}
                    onClick={() => window.confirm(`Remove ${m.name ?? "this person"} from ${data.organisation.name}? They lose access straight away.`) && void run(`rm-${m.id}`, () => api(`${base}/members/${m.id}`, { method: "DELETE" }), `${m.name ?? "Staff member"} removed.`)}
                  >
                    <Trash2 size={14} aria-hidden="true" /> Remove
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 font-bold text-zinc-900">Invite staff</h3>
      <p className="mt-1 text-sm text-zinc-600">
        The invite works only for the Google account with this email, and expires in 14 days.
        {data.me.superadmin ? "" : " For places under yours you can appoint only their admins; they add their own staff."}
      </p>
      <form onSubmit={sendInvite} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="inv-email" className={labelClass}>Email (their Google account)</label>
          <input id="inv-email" type="email" required maxLength={255} value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} className={inputClass} />
        </div>
        {network ? (
          <div>
            <label htmlFor="inv-place" className={labelClass}>Place</label>
            <select id="inv-place" value={invite.unitId} onChange={(e) => setInvite({ ...invite, unitId: e.target.value, designationId: "" })} className={inputClass}>
              {places.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        ) : null}
        <div>
          <label htmlFor="inv-designation" className={labelClass}>Designation</label>
          <select id="inv-designation" required value={invite.designationId} onChange={(e) => setInvite({ ...invite, designationId: e.target.value })} className={inputClass}>
            <option value="" disabled>Choose…</option>
            {data.designations.filter((d) => allowedAt(invite.unitId, d)).map(inviteOption)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy === "invite"} className={primaryButton}>
            {busy === "invite" ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} Create invite
          </button>
        </div>
      </form>

      {data.invites.length ? (
        <>
          <h3 className="mt-6 font-bold text-zinc-900">Open invites</h3>
          <ul className="mt-2 divide-y divide-zinc-100">
            {data.invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900">{i.email}</p>
                  <p className="text-sm text-zinc-600">
                    {designationName(i.designationId)} · {placeName(i.unitId)} ·{" "}
                    {i.status === "awaiting_approval" ? (
                      <span className="text-amber-700">Waiting for NowRJ approval</span>
                    ) : i.expired ? <span className="text-red-700">Expired</span> : `Expires ${new Date(i.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!i.expired && i.token ? (
                    <>
                      <button type="button" className={quietButton} onClick={() => void copy(i.token!)}>
                        {copied === i.token ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied === i.token ? "Copied" : "Copy link"}
                      </button>
                      <a
                        className={quietButton}
                        target="_blank"
                        rel="noreferrer"
                        href={`https://wa.me/?text=${encodeURIComponent(`You're invited to join ${data.organisation.name} on NowRJ as ${designationName(i.designationId)}. Sign in with ${i.email}: ${inviteLink(i.token!)}`)}`}
                      >
                        <MessageCircle size={14} aria-hidden="true" /> WhatsApp
                      </a>
                    </>
                  ) : null}
                  <button type="button" className={dangerButton} disabled={busy !== null} onClick={() => void run(`inv-${i.id}`, () => api(`${base}/invites/${i.id}`, { method: "DELETE" }), "Invite cancelled.")}>
                    <X size={14} aria-hidden="true" /> Cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Card>
  );
}
