"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, LoaderCircle, Pencil, Plus, Power, Radio, X } from "lucide-react";
import AuthControls from "../AuthControls";
import GuestSessions from "../lib/guest-sessions";
import TeamInbox from "../lib/team-inbox";
import { InteractionSettings } from "../lib/interaction-settings";
import { ParticipationSettings, type ParticipationMode } from "../lib/participation-settings";
import type { InteractionType } from "../lib/interaction";
import { api, Card, inputClass, isSignedIn, labelClass, Notice, primaryButton, quietButton, signInAndReturn, StatusPill } from "../lib/ui";
import { HelpLink } from "../lib/help";

type Office = { organisationId: string; organisationName: string; unitId: string | null; unitName: string | null; programmes: string };
type Carrier = { programmeId: string; slug: string; stationId: string; stationName: string; carrying: boolean; schedule: string };
type NetworkProgramme = {
  id: string;
  name: string;
  unitId: string | null;
  placeName: string;
  interactionType: InteractionType;
  noticeText: string | null;
  participation: ParticipationMode;
  participationPrompt: string | null;
  isActive: boolean;
  rjs: { id: string; name: string }[];
  stations: Carrier[];
};
type OfficeData = {
  office: { organisationId: string; organisationName: string; unitId: string | null; unitName: string | null; canEdit: boolean };
  places: { id: string | null; name: string }[];
  rjOptions: { id: string; name: string }[];
  programmes: NetworkProgramme[];
};

/** Network programmes: a regional or head office makes a programme once; its stations carry it at their own times. */
export default function NetworkPage() {
  const [signedIn, setSignedIn] = useState(true);
  const [offices, setOffices] = useState<Office[] | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        if (!(await isSignedIn())) {
          setSignedIn(false);
          return;
        }
        const list = await api<Office[]>("/network-programmes/offices");
        setOffices(list);
        const wanted = new URLSearchParams(window.location.search).get("org");
        setOrgId(list.find((o) => o.organisationId === wanted)?.organisationId ?? list[0]?.organisationId ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load your offices.");
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 hover:underline">
            <ArrowLeft size={16} aria-hidden="true" /> Back to NowRJ
          </Link>
          <AuthControls />
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-orange-700">Network programmes</p>
        {!signedIn ? (
          <Card>
            <p className="text-zinc-700">Sign in with the Google account your network added as staff.</p>
            <button type="button" onClick={signInAndReturn} className={`${primaryButton} mt-4`}>Sign in with Google</button>
          </Card>
        ) : error ? (
          <Notice kind="error" text={error} />
        ) : !offices ? (
          <p className="mt-6 text-zinc-600"><LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />Loading…</p>
        ) : offices.length === 0 ? (
          <Card>
            <h1 className="text-xl font-bold text-zinc-900">No network office</h1>
            <p className="mt-2 text-zinc-600">This page is for staff at a network&apos;s head office or regional office whose designation includes Programmes.</p>
          </Card>
        ) : (
          <>
            {offices.length > 1 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {offices.map((o) => (
                  <button key={o.organisationId} type="button" onClick={() => setOrgId(o.organisationId)} className={`${quietButton} ${orgId === o.organisationId ? "border-orange-500 bg-orange-50" : ""}`}>
                    {o.organisationName}
                  </button>
                ))}
              </div>
            ) : null}
            {orgId ? <OfficePanel key={orgId} organisationId={orgId} /> : null}
          </>
        )}
      </div>
    </main>
  );
}

function OfficePanel({ organisationId }: { organisationId: string }) {
  const [data, setData] = useState<OfficeData | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<OfficeData>(`/network-programmes?organisationId=${organisationId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load programmes.");
    }
  }, [organisationId]);

  useEffect(() => {
    // Loaded after the first paint (not inside the effect body).
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function setActive(p: NetworkProgramme, active: boolean) {
    if (!active && !window.confirm(`Stop ${p.name} on every station? Their upcoming times end today. Past shows and messages stay.`)) return;
    setBusy(p.id);
    setError("");
    try {
      await api(`/network-programmes/${p.id}/active`, { method: "PUT", body: JSON.stringify({ active }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change it.");
    } finally {
      setBusy(null);
    }
  }

  if (!data) return error ? <Notice kind="error" text={error} /> : null;
  const { office } = data;
  const copies = data.programmes.flatMap((p) => p.stations.filter((s) => s.carrying).map((s) => ({ id: s.programmeId, name: `${p.name} · ${s.stationName}` })));

  return (
    <>
      <Card>
        <h1 className="text-2xl font-bold text-zinc-900">{office.organisationName}</h1>
        <HelpLink role="network" guide="create" className="-ml-2" />
        <p className="text-sm text-zinc-600">{office.unitName ? `${office.unitName} regional office` : "Head office"}{office.canEdit ? "" : " · view only"}</p>
        <p className="mt-3 text-sm text-zinc-700">
          Make a programme once. Each station under {office.unitName ?? "the network"} chooses to carry it and sets its own times and repeats. Changes you make here
          (name, RJs, what listeners can send) reach every station.
        </p>
        {error ? <Notice kind="error" text={error} /> : null}

        <ul className="mt-4 divide-y divide-zinc-100">
          {data.programmes.map((p) => (
            <li key={p.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900">{p.name}</p>
                  <p className="text-xs text-zinc-500">For {p.placeName}{p.rjs.length ? ` · with ${p.rjs.map((r) => r.name).join(", ")}` : " · no RJs yet"}</p>
                </div>
                {p.isActive ? <StatusPill text={`${p.stations.filter((s) => s.carrying).length} station${p.stations.filter((s) => s.carrying).length === 1 ? "" : "s"}`} tone="green" /> : <StatusPill text="Stopped" tone="zinc" />}
              </div>
              {p.stations.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {p.stations.map((s) => (
                    <li key={s.programmeId} className="flex flex-wrap gap-x-2 text-zinc-700">
                      <Radio size={13} className="mt-1 text-orange-600" aria-hidden="true" />
                      {s.carrying ? <Link href={`/programme/${s.slug}`} className="font-semibold hover:text-orange-700">{s.stationName}</Link> : <span className="text-zinc-500">{s.stationName} (stopped)</span>}
                      {s.carrying ? <span>{s.schedule || "no times yet"}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : p.isActive ? (
                <p className="mt-1 text-sm text-zinc-500">No station carries it yet. Station programme staff see it on their dashboard.</p>
              ) : null}
              {office.canEdit && editing !== p.id ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditing(p.id)} className={quietButton}><Pencil size={14} aria-hidden="true" /> Edit</button>
                  <button type="button" disabled={busy === p.id} onClick={() => void setActive(p, !p.isActive)} className={quietButton}>
                    <Power size={14} aria-hidden="true" /> {p.isActive ? "Stop everywhere" : "Restart"}
                  </button>
                </div>
              ) : null}
              {editing === p.id ? (
                <ProgrammeForm data={data} programme={p} onDone={async (saved) => { setEditing(null); if (saved) await load(); }} />
              ) : null}
            </li>
          ))}
        </ul>
        {data.programmes.length === 0 ? <p className="mt-3 text-sm text-zinc-600">No network programmes yet.</p> : null}

        {office.canEdit ? (
          adding ? (
            <ProgrammeForm data={data} onDone={async (saved) => { setAdding(false); if (saved) await load(); }} />
          ) : (
            <button type="button" onClick={() => setAdding(true)} className={`${primaryButton} mt-4`}><Plus size={16} aria-hidden="true" /> New network programme</button>
          )
        ) : null}
      </Card>

      <Card title="Taking part, nominations & private messages" help={{ role: "network", guide: "inbox" }}>
        <p className="mt-1 text-sm text-zinc-600">From listeners of your programmes on every station.</p>
        <TeamInbox query={`as=network&organisationId=${organisationId}`} />
      </Card>

      <Card title="Guest recordings: ask the guest or RJ" help={{ role: "network", guide: "guest-recordings" }}>
        <p className="mt-1 text-sm text-zinc-600">Set up a guest recording on one station&apos;s copy; listeners send questions and ask to take part before it is recorded.</p>
        <GuestSessions path={`/guest-sessions/network/${organisationId}`} programmes={copies} readOnly={!office.canEdit} />
      </Card>
    </>
  );
}

function ProgrammeForm({ data, programme, onDone }: { data: OfficeData; programme?: NetworkProgramme; onDone: (saved: boolean) => Promise<void> }) {
  const id = programme?.id ?? "new";
  const [name, setName] = useState(programme?.name ?? "");
  const [unitId, setUnitId] = useState<string>(programme?.unitId ?? data.places[0]?.id ?? "");
  const [rjIds, setRjIds] = useState<string[]>(programme?.rjs.map((r) => r.id) ?? []);
  const [type, setType] = useState<InteractionType>(programme?.interactionType ?? "song");
  const [notice, setNotice] = useState(programme?.noticeText ?? "");
  const [mode, setMode] = useState<ParticipationMode>(programme?.participation ?? "off");
  const [prompt, setPrompt] = useState(programme?.participationPrompt ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = { name, rjIds, interactionType: type, noticeText: notice.trim() || null, participation: mode, participationPrompt: prompt.trim() || null };
    try {
      if (programme) {
        await api(`/network-programmes/${programme.id}`, { method: "PATCH", body: JSON.stringify(fields) });
      } else {
        await api("/network-programmes", { method: "POST", body: JSON.stringify({ ...fields, organisationId: data.office.organisationId, unitId: unitId || null }) });
      }
      await onDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-4 rounded-xl bg-zinc-50 p-4">
      <div>
        <label htmlFor={`np-name-${id}`} className={labelClass}>Programme name</label>
        <input id={`np-name-${id}`} required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>
      {!programme ? (
        <div>
          <label htmlFor={`np-place-${id}`} className={labelClass}>For the stations of</label>
          <select id={`np-place-${id}`} value={unitId} onChange={(e) => setUnitId(e.target.value)} className={inputClass}>
            {data.places.map((p) => <option key={p.id ?? "all"} value={p.id ?? ""}>{p.name}</option>)}
          </select>
        </div>
      ) : null}
      <fieldset>
        <legend className={labelClass}>RJs</legend>
        {data.rjOptions.length === 0 ? (
          <p className="text-sm text-zinc-600">No RJs work with the network yet. Invite them from Staff &amp; designations → RJs.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.rjOptions.map((rj) => {
              const on = rjIds.includes(rj.id);
              return (
                <label key={rj.id} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold ${on ? "border-orange-600 bg-orange-50 text-orange-800" : "border-zinc-300 bg-white text-zinc-700"}`}>
                  <input type="checkbox" checked={on} onChange={() => setRjIds((all) => (on ? all.filter((x) => x !== rj.id) : [...all, rj.id]))} className="accent-orange-600" />
                  {rj.name}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
      <InteractionSettings id={`np-${id}`} type={type} notice={notice} onType={setType} onNotice={setNotice} />
      <ParticipationSettings id={`np-${id}`} mode={mode} prompt={prompt} onMode={setMode} onPrompt={setPrompt} />
      {error ? <Notice kind="error" text={error} /> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
          {programme ? "Save changes" : "Create programme"}
        </button>
        <button type="button" disabled={busy} onClick={() => void onDone(false)} className={quietButton}><X size={14} aria-hidden="true" /> Cancel</button>
      </div>
    </form>
  );
}
