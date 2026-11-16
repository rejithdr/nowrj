"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, MapPin } from "lucide-react";
import { api, inputClass, Notice, primaryButton } from "./ui";

import { DISTRICT_COOKIE, type District } from "./district-cookie";

function byState(districts: District[]) {
  const states: { state: string; districts: District[] }[] = [];
  for (const d of districts) {
    let group = states.find((s) => s.state === d.state);
    if (!group) states.push((group = { state: d.state, districts: [] }));
    group.districts.push(d);
  }
  return states;
}

/** Home page: choose your district once; only stations that reach it are shown. */
export function DistrictPicker({ districts, current }: { districts: District[]; current: string | null }) {
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  const [saving, setSaving] = useState(false);
  const chosen = districts.find((d) => d.id === current) ?? null;

  function choose(id: string) {
    if (!id) return;
    document.cookie = `${DISTRICT_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
    setSaving(true);
    setChanging(false);
    router.refresh();
    window.setTimeout(() => setSaving(false), 1500);
  }

  const select = (
    <select
      id="district"
      aria-label="Your district"
      value=""
      onChange={(e) => choose(e.target.value)}
      className={`${inputClass} mt-2 text-base`}
    >
      <option value="" disabled>Select your district</option>
      {byState(districts).map((group) => (
        <optgroup key={group.state} label={group.state}>
          {group.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </optgroup>
      ))}
    </select>
  );

  if (!chosen) {
    return (
      <section className="mb-7 rounded-2xl border border-orange-200 bg-orange-50 p-4">
        <p className="flex items-center gap-2 text-base font-bold text-zinc-900">
          <MapPin size={18} className="text-orange-600" aria-hidden="true" /> Choose your district
        </p>
        <p className="mt-1 text-sm text-zinc-700">We&apos;ll show the stations you can hear there.</p>
        {select}
      </section>
    );
  }

  return (
    <div className="mb-5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-700">
        <MapPin size={16} className="text-orange-600" aria-hidden="true" />
        <span>
          Stations in <strong className="text-zinc-900">{chosen.name}</strong>
        </span>
        {saving ? <LoaderCircle size={14} className="animate-spin text-zinc-500" aria-label="Updating" /> : null}
        <button type="button" onClick={() => setChanging(!changing)} className="font-semibold text-orange-700 hover:underline">
          {changing ? "Cancel" : "Change"}
        </button>
      </p>
      {changing ? <div className="max-w-sm">{select}</div> : null}
    </div>
  );
}

/**
 * Station dashboard and Super Admin: tick the districts a station reaches.
 * `base` is /districts/stations/<id> for staff or /admin/districts/stations/<id>.
 */
export function StationDistricts({ base, readOnly = false }: { base: string; readOnly?: boolean }) {
  const [all, setAll] = useState<District[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [list, station] = await Promise.all([api<District[]>("/districts"), api<{ districts: string[] }>(base)]);
      setAll(list);
      setPicked(station.districts);
      setSaved(station.districts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load districts.");
    } finally {
      setLoaded(true);
    }
  }, [base]);

  useEffect(() => {
    setMessage("");
    void load();
  }, [load]);

  const groups = useMemo(() => byState(all), [all]);
  const names = (ids: string[]) => all.filter((d) => ids.includes(d.id)).map((d) => d.name).join(", ");
  const changed = picked.length !== saved.length || picked.some((id) => !saved.includes(id));

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ districts: string[] }>(base, { method: "PUT", body: JSON.stringify({ districts: picked }) });
      setPicked(result.districts);
      setSaved(result.districts);
      setMessage("Saved. Listeners in these districts now see this station.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <p className="mt-2 text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="mt-2">
      <p className="text-sm text-zinc-600">
        {saved.length
          ? <>Listeners in <strong className="text-zinc-900">{names(saved)}</strong> see this station&apos;s programmes.</>
          : "Not chosen yet, so listeners in every district see this station. Tick the districts your signal reaches."}
      </p>
      {error ? <Notice kind="error" text={error} /> : null}
      {message ? <Notice kind="ok" text={message} /> : null}
      {readOnly ? null : (
        <>
          {groups.map((group) => (
            <fieldset key={group.state} className="mt-3">
              <legend className="text-sm font-semibold text-zinc-900">{group.state}</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {group.districts.map((d) => {
                  const on = picked.includes(d.id);
                  return (
                    <label
                      key={d.id}
                      className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm ${on ? "border-orange-400 bg-orange-50 font-semibold text-orange-800" : "border-zinc-300 bg-white text-zinc-700"}`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() => setPicked(on ? picked.filter((id) => id !== d.id) : [...picked, d.id])}
                      />
                      {on ? <Check size={14} aria-hidden="true" /> : null}
                      {d.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <button type="button" disabled={busy || !changed || !picked.length} onClick={() => void save()} className={`${primaryButton} mt-4`}>
            {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} Save districts
          </button>
        </>
      )}
    </div>
  );
}
