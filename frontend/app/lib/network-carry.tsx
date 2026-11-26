"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, Plus, Radio, X } from "lucide-react";
import { api, Notice, primaryButton, quietButton, dangerButton, StatusPill } from "./ui";
import { emptySlot, SlotEditor, type SlotDraft } from "./slot-editor";

type Offered = {
  id: string;
  name: string;
  placeName: string;
  isActive: boolean;
  noticeText: string | null;
  rjs: string[];
  programmeId: string | null;
  slug: string | null;
  carrying: boolean;
  slots: { id: string; days: number[]; startTime: string; endTime: string; repeat: boolean }[];
};

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** "Every day", "Mon–Fri", or "Mon, Wed, Fri". */
function days(list: number[]) {
  const d = [...list].sort((a, b) => a - b);
  if (d.length === 7) return "Every day";
  if (d.length >= 3 && d.every((x, i) => i === 0 || x === d[i - 1] + 1)) return `${DAY[d[0] - 1]}–${DAY[d[d.length - 1] - 1]}`;
  return d.map((x) => DAY[x - 1]).join(", ");
}
const label = (s: { days: number[]; startTime: string; endTime: string; repeat?: boolean }) =>
  `${days(s.days)} ${s.startTime}–${s.endTime}${s.repeat ? " (repeat)" : ""}`;

/** Asks again with confirmDrop when the change would delete upcoming shows that have things attached. */
async function withConfirm(send: (confirm: boolean) => Promise<unknown>) {
  try {
    await send(false);
  } catch (err) {
    const text = err instanceof Error ? err.message : "";
    if (!text.startsWith("This change removes") || !window.confirm(`${text}\n\nGo ahead and remove them?`)) throw err;
    await send(true);
  }
}

/**
 * Programmes the network's regional or head office made for this station:
 * the station chooses to carry each one and sets its own times and repeats.
 */
export default function NetworkCarry({ stationId, canEdit }: { stationId: string; canEdit: boolean }) {
  const [items, setItems] = useState<Offered[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await api<Offered[]>(`/stations/${stationId}/network-programmes`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load network programmes.");
    }
  }, [stationId]);

  useEffect(() => {
    // Loaded after the first paint (not inside the effect body).
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function edit(p: Offered) {
    setError("");
    setMessage("");
    setEditing(p.id);
    setSlots(p.slots.length ? p.slots.map((s) => ({ days: [...s.days], startTime: s.startTime, endTime: s.endTime, repeat: s.repeat })) : [emptySlot(), emptySlot(true)]);
  }

  async function save(p: Offered) {
    setBusy(true);
    setError("");
    try {
      await withConfirm((confirmDrop) =>
        api(`/stations/${stationId}/network-programmes/${p.id}`, { method: "PUT", body: JSON.stringify({ schedule: slots, confirmDrop }) }),
      );
      setEditing(null);
      setMessage(p.carrying ? `Saved the times for ${p.name}.` : `${p.name} is now on your station.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function stop(p: Offered) {
    if (!window.confirm(`Stop carrying ${p.name}? Its times end today. Past shows, messages and counts stay.`)) return;
    setBusy(true);
    setError("");
    try {
      await withConfirm((confirm) => api(`/stations/${stationId}/network-programmes/${p.id}${confirm ? "?confirm=true" : ""}`, { method: "DELETE" }));
      setMessage(`${p.name} is off your station.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop it.");
    } finally {
      setBusy(false);
    }
  }

  if (!items) return error ? <Notice kind="error" text={error} /> : null;
  return (
    <div className="mt-2">
      {message ? <Notice kind="ok" text={message} /> : null}
      {error ? <Notice kind="error" text={error} /> : null}
      {items.length === 0 ? <p className="mt-2 text-sm text-zinc-600">Your network office has not made any programmes for this station yet.</p> : null}
      <ul className="mt-2 divide-y divide-zinc-100">
        {items.map((p) => (
          <li key={p.id} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900">
                  <Radio size={14} className="mr-1 inline text-orange-600" aria-hidden="true" />
                  {p.carrying && p.slug ? <Link href={`/programme/${p.slug}`} className="hover:text-orange-700">{p.name}</Link> : p.name}
                </p>
                <p className="text-xs text-zinc-500">From {p.placeName}{p.rjs.length ? ` · with ${p.rjs.join(", ")}` : ""}</p>
                {p.carrying ? <p className="text-sm text-zinc-700">{p.slots.map(label).join(" · ") || "No times"}</p> : null}
              </div>
              {!p.isActive ? (
                <StatusPill text="Stopped by the office" tone="zinc" />
              ) : p.carrying ? (
                <StatusPill text="On your station" tone="green" />
              ) : (
                <StatusPill text="Not carried" tone="amber" />
              )}
            </div>
            {canEdit && p.isActive && editing !== p.id ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => edit(p)} className={quietButton}>{p.carrying ? "Change times & repeats" : "Carry on this station"}</button>
                {p.carrying ? <button type="button" disabled={busy} onClick={() => void stop(p)} className={dangerButton}>Stop carrying</button> : null}
              </div>
            ) : null}
            {editing === p.id ? (
              <div className="mt-3 space-y-3 rounded-xl bg-zinc-50 p-3">
                <p className="text-sm text-zinc-700">Set when {p.name} airs on your station. Tick <strong>Repeat</strong> for replays of an earlier broadcast; listeners see them marked as repeats.</p>
                {slots.map((slot, index) => (
                  <SlotEditor
                    key={index}
                    idPrefix={`np-${p.id}`}
                    slot={slot}
                    index={index}
                    onChange={(next) => setSlots((all) => all.map((s, i) => (i === index ? next : s)))}
                    onRemove={slots.length > 1 ? () => setSlots((all) => all.filter((_, i) => i !== index)) : undefined}
                  />
                ))}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSlots((all) => [...all, emptySlot()])} className={quietButton}><Plus size={14} aria-hidden="true" /> Add a time</button>
                  <button type="button" onClick={() => setSlots((all) => [...all, emptySlot(true)])} className={quietButton}><Plus size={14} aria-hidden="true" /> Add a repeat</button>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void save(p)} className={primaryButton}>
                    {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                    {p.carrying ? "Save times" : "Carry it"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setEditing(null)} className={quietButton}><X size={14} aria-hidden="true" /> Cancel</button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
