"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, LoaderCircle, Phone, X } from "lucide-react";
import EngagementPanel from "../../lib/engagement";
import AuthControls from "../../AuthControls";
import UpcomingShows from "../../lib/show-changes";
import StationRjs from "../../lib/station-rjs";
import { api, Card, inputClass, isSignedIn, Notice, primaryButton, quietButton, signInAndReturn, StatusPill } from "../../lib/ui";

type MyStation = {
  roleStatus: "pending" | "active";
  station: { id: string; name: string; slug: string; city: string | null; verificationStatus: string; isActive: boolean };
};

type StationProgramme = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  callInPhone: string | null;
  ownedByStation: boolean;
  ownerRjName: string | null;
  schedule: string;
  latestClaim: { id: string; status: string; rjReason: string | null; adminReason: string | null } | null;
};

const claimText: Record<string, { text: string; tone: "green" | "amber" | "red" | "zinc" }> = {
  awaiting_rj: { text: "Waiting for the RJ", tone: "amber" },
  rejected_by_rj: { text: "RJ declined · NowRJ team reviewing", tone: "amber" },
  rejected_by_admin: { text: "Claim not approved", tone: "red" },
};

export default function StationDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [stations, setStations] = useState<MyStation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        if (!(await isSignedIn())) {
          setSignedIn(false);
          return;
        }
        setStations(await api<MyStation[]>("/station-reps/me/stations"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load your stations.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

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
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-orange-700">Station dashboard</p>

        {!signedIn ? (
          <Card>
            <p className="text-zinc-700">Sign in with the Google account you used to apply for your station.</p>
            <button type="button" onClick={signInAndReturn} className={`${primaryButton} mt-4`}>Sign in with Google</button>
          </Card>
        ) : loading ? (
          <p className="mt-6 text-zinc-600"><LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />Loading…</p>
        ) : error ? (
          <Notice kind="error" text={error} />
        ) : stations.length === 0 ? (
          <Card>
            <h1 className="text-xl font-bold text-zinc-900">You don&apos;t represent a station yet</h1>
            <p className="mt-2 text-zinc-600">
              Use the invite link one of your RJs sent you, or <Link href="/for-stations" className="font-semibold text-orange-700 hover:underline">apply to join</Link> directly.
            </p>
          </Card>
        ) : (
          stations.map((entry) => <StationPanel key={entry.station.id} entry={entry} />)
        )}
      </div>
    </main>
  );
}

function StationPanel({ entry }: { entry: MyStation }) {
  const { station, roleStatus } = entry;
  const [programmes, setProgrammes] = useState<StationProgramme[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (roleStatus !== "active") return;
    setProgrammes(await api<StationProgramme[]>(`/station-reps/me/stations/${station.id}/programmes`));
  }, [roleStatus, station.id]);

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Could not load programmes."));
  }, [refresh]);

  async function claim(programme: StationProgramme) {
    setError("");
    setMessage("");
    setBusyId(programme.id);
    try {
      await api(`/station-reps/me/stations/${station.id}/programmes/${programme.id}/claim`, { method: "POST" });
      setMessage(`Claim sent. ${programme.ownerRjName ?? "The RJ"} will be asked to approve it.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the claim.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-zinc-900">{station.name}</h1>
        {roleStatus === "pending" ? <StatusPill text="Awaiting verification" tone="amber" /> : <StatusPill text="Verified" tone="green" />}
      </div>
      {station.city ? <p className="text-sm text-zinc-600">{station.city}</p> : null}

      {roleStatus === "pending" ? (
        <Notice kind="info" text="The NowRJ team is verifying your station and your role. You'll be able to manage programmes once approved." />
      ) : (
        <>
          <h2 className="mt-6 text-lg font-bold text-zinc-900">Listener engagement</h2>
          <EngagementPanel path={`/shows/engagement/station/${station.id}`} showHosts />

          <h2 className="mt-8 text-lg font-bold text-zinc-900">RJs at {station.name}</h2>
          <p className="mt-1 text-sm text-zinc-600">RJs list your station in their history. Confirm the dates you recognise, or dispute them with a note.</p>
          <StationRjs stationId={station.id} />

          <h2 className="mt-8 text-lg font-bold text-zinc-900">Programmes on {station.name}</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Programmes an RJ created stay theirs until you claim them and the RJ agrees. If the RJ declines, the NowRJ team decides.
          </p>
          {message ? <Notice kind="ok" text={message} /> : null}
          {error ? <Notice kind="error" text={error} /> : null}
          {programmes.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No programmes yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100">
              {programmes.map((p) => {
                const pending = p.latestClaim && claimText[p.latestClaim.status];
                return (
                  <li key={p.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link href={`/programme/${p.slug}`} className="font-semibold text-zinc-900 hover:text-orange-700">{p.name}</Link>
                        <p className="text-sm text-zinc-600">{p.schedule || "Schedule not set"}</p>
                        <p className="text-xs text-zinc-500">{p.ownedByStation ? "Owned by your station" : `Owned by ${p.ownerRjName ?? "an RJ"}`}</p>
                      </div>
                      {p.ownedByStation ? (
                        <CallInEditor stationId={station.id} programme={p} onSaved={refresh} />
                      ) : pending && p.latestClaim?.status !== "rejected_by_admin" ? (
                        <StatusPill text={pending.text} tone={pending.tone} />
                      ) : (
                        <button type="button" disabled={busyId === p.id} onClick={() => void claim(p)} className={quietButton}>
                          {busyId === p.id ? "Sending…" : "Claim programme"}
                        </button>
                      )}
                    </div>
                    {p.latestClaim?.status === "rejected_by_admin" ? (
                      <p className="mt-1 text-xs text-red-700">Previous claim not approved{p.latestClaim.adminReason ? `: ${p.latestClaim.adminReason}` : "."}</p>
                    ) : null}
                    {p.ownedByStation && p.schedule ? <UpcomingShows programmeId={p.id} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

/** Name and call-in number of a programme the station owns, saved together. */
function CallInEditor({ stationId, programme, onSaved }: { stationId: string; programme: StationProgramme; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(programme.name);
  const [value, setValue] = useState(programme.callInPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const base = `/station-reps/me/stations/${stationId}/programmes/${programme.id}`;
      if (name.trim() !== programme.name) {
        await api(`${base}/name`, { method: "PATCH", body: JSON.stringify({ name }) });
      }
      if ((value || null) !== programme.callInPhone) {
        await api(`${base}/call-in`, { method: "PATCH", body: JSON.stringify({ callInPhone: value || null }) });
      }
      setEditing(false);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className={quietButton}>
        <Phone size={14} aria-hidden="true" />
        {programme.callInPhone ?? "Add call-in number"} · Edit
      </button>
    );
  }
  return (
    <div className="w-full space-y-2 rounded-xl bg-zinc-50 p-3">
      <label htmlFor={`name-${programme.id}`} className="block text-sm font-medium text-zinc-800">Programme name</label>
      <input id={`name-${programme.id}`} maxLength={150} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      <label htmlFor={`call-${programme.id}`} className="block text-sm font-medium text-zinc-800">Call-in number</label>
      <input id={`call-${programme.id}`} type="tel" maxLength={20} value={value} onChange={(e) => setValue(e.target.value)} className={`${inputClass} max-w-48`} />
      <div className="flex gap-2">
        <button type="button" onClick={() => void save()} disabled={busy} className={primaryButton}>
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
          Save changes
        </button>
        <button type="button" onClick={() => { setEditing(false); setName(programme.name); setValue(programme.callInPhone ?? ""); }} className={quietButton}>
          <X size={14} aria-hidden="true" /> Cancel
        </button>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
