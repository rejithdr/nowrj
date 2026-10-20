"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  LoaderCircle,
  Mail,
  Pencil,
  Phone,
  Plus,
  Radio,
  X,
} from "lucide-react";

const API = "http://localhost:3000";

type RjProfile = {
  id: string;
  name: string;
  slug: string;
  verificationStatus: string;
  isActive: boolean;
};

type Station = { id: string; name: string; city: string | null; isActive: boolean };

type Affiliation = {
  id: string;
  stationName: string;
  joinedOn: string;
  leftOn: string | null;
  verificationStatus: string;
  current: boolean;
  stationId: string;
};

type Invite = {
  id: string;
  stationName: string;
  city: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: string;
  expiresAt: string;
};

type MyProgramme = {
  id: string;
  name: string;
  slug: string;
  startTime: string | null;
  endTime: string | null;
  callInPhone: string | null;
  isActive: boolean;
  stationName: string | null;
  invitedStationName: string | null;
  ownerStationName: string | null;
  ownedByYou: boolean;
};

const inputClass =
  "min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
const labelClass = "mb-1.5 block text-sm font-medium text-zinc-800";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-orange-600 px-5 font-semibold text-white hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60";
const quietButton =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:border-orange-300 hover:bg-orange-50";

function today() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
    throw Object.assign(new Error(message || "Something went wrong. Please try again."), {
      status: response.status,
    });
  }
  return data as T;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

function Notice({ kind, text }: { kind: "error" | "ok"; text: string }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`mt-4 rounded-lg border p-3 text-sm ${
        kind === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-green-200 bg-green-50 text-green-800"
      }`}
    >
      {text}
    </p>
  );
}

export default function RjDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<RjProfile | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [history, setHistory] = useState<Affiliation[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [programmes, setProgrammes] = useState<MyProgramme[]>([]);
  const [pageError, setPageError] = useState("");

  const refresh = useCallback(async () => {
    const [h, i, p] = await Promise.all([
      api<Affiliation[]>("/rjs/me/stations"),
      api<Invite[]>("/rjs/me/station-invites"),
      api<MyProgramme[]>("/rjs/me/programmes"),
    ]);
    setHistory(h);
    setInvites(i);
    setProgrammes(p);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const auth = await fetch(`${API}/auth/me`, { credentials: "include", cache: "no-store" });
        if (auth.status === 401) {
          sessionStorage.setItem("nowrjReturnTo", "/rj/dashboard");
          window.location.href = `${API}/auth/google?returnTo=%2Frj%2Fdashboard`;
          return;
        }
        const me = await api<RjProfile | null>("/rjs/me");
        setProfile(me);
        if (me) {
          const allStations = await api<Station[]>("/stations");
          setStations(allStations.filter((s) => s.isActive));
          await refresh();
        }
      } catch (error) {
        setPageError(error instanceof Error ? error.message : "Could not load your dashboard.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [refresh]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-zinc-600">
        <LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />
        Loading your dashboard…
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        {pageError ? <Notice kind="error" text={pageError} /> : null}
        <h1 className="text-2xl font-bold text-zinc-900">No RJ profile yet</h1>
        <p className="mt-2 text-zinc-600">Create your RJ profile first, then come back here.</p>
        <Link href="/rj/register" className={`${primaryButton} mt-6`}>
          Create RJ profile
        </Link>
      </main>
    );
  }

  const current = history.find((row) => row.current) ?? null;
  const openInvites = invites.filter((invite) => invite.status === "sent");
  const verified = ["verified", "legacy"].includes(profile.verificationStatus);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 hover:underline">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to NowRJ
        </Link>

        <header className="mt-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">RJ dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">{profile.name}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {verified ? (
              <>
                Verified ·{" "}
                <Link href={`/rj/${profile.slug}`} className="font-semibold text-orange-700 hover:underline">
                  View public profile
                </Link>
              </>
            ) : profile.verificationStatus === "rejected" ? (
              "Your profile was not approved. Please contact the NowRJ team."
            ) : (
              "Awaiting verification. Your profile and programmes stay hidden from listeners until the NowRJ team approves you."
            )}
          </p>
        </header>

        {pageError ? <Notice kind="error" text={pageError} /> : null}

        <StationSection stations={stations} current={current} history={history} onChanged={refresh} />
        <InviteSection invites={invites} onChanged={refresh} />
        <ProgrammeSection
          current={current}
          openInvites={openInvites}
          programmes={programmes}
          verified={verified}
          onChanged={refresh}
        />
      </div>
    </main>
  );
}

// ------------------------------------------------------------------ station

function StationSection({
  stations,
  current,
  history,
  onChanged,
}: {
  stations: Station[];
  current: Affiliation | null;
  history: Affiliation[];
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [stationId, setStationId] = useState("");
  const [joinedOn, setJoinedOn] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const result = await api<{ stationName: string; previousLeftOn: string | null }>("/rjs/me/station", {
        method: "POST",
        body: JSON.stringify({ stationId, joinedOn }),
      });
      setMessage(
        result.previousLeftOn
          ? `You're now at ${result.stationName}. Your previous station was closed on ${formatDate(result.previousLeftOn)}.`
          : `You're now at ${result.stationName}.`,
      );
      setOpen(false);
      setStationId("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const choices = stations.filter((s) => s.id !== current?.stationId);

  return (
    <Section title="Your station">
      {current ? (
        <div className="mt-3 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
            <Radio size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-zinc-900">{current.stationName}</p>
            <p className="text-sm text-zinc-600">
              Since {formatDate(current.joinedOn)} ·{" "}
              {current.verificationStatus === "verified" ? "Confirmed" : "Awaiting confirmation"}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-600">
          You haven&apos;t chosen a station yet. Pick yours below, or invite it if it&apos;s not listed.
        </p>
      )}

      {message ? <Notice kind="ok" text={message} /> : null}

      {open ? (
        <form onSubmit={submit} className="mt-4 grid gap-4 rounded-xl bg-zinc-50 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="station" className={labelClass}>
              {current ? "New station" : "Station"}
            </label>
            <select id="station" required value={stationId} onChange={(e) => setStationId(e.target.value)} className={inputClass}>
              <option value="">Choose a station</option>
              {choices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.city ? `, ${s.city}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="joined" className={labelClass}>
              Date you joined
            </label>
            <input id="joined" type="date" required max={today()} value={joinedOn} onChange={(e) => setJoinedOn(e.target.value)} className={inputClass} />
          </div>
          <p className="self-end text-xs leading-5 text-zinc-500">
            {current
              ? `Your time at ${current.stationName} will end the day before this date.`
              : "Use your actual joining date, even if it was years ago."}
          </p>
          {error ? (
            <div className="sm:col-span-2">
              <Notice kind="error" text={error} />
            </div>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className={primaryButton}>
              {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              Save station
            </button>
            <button type="button" onClick={() => setOpen(false)} className={quietButton}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { setOpen(true); setMessage(""); }} className={`${quietButton} mt-4`}>
          <Pencil size={14} aria-hidden="true" />
          {current ? "Change station" : "Choose station"}
        </button>
      )}

      {history.length > 1 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-zinc-800">Station history</h3>
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {history.map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-2">
                <span className="text-zinc-900">{row.stationName}</span>
                <span className="text-zinc-600">
                  {formatDate(row.joinedOn)} – {row.leftOn ? formatDate(row.leftOn) : "present"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

// ------------------------------------------------------------------ invites

function InviteSection({ invites, onChanged }: { invites: Invite[]; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ stationName: "", city: "", contactName: "", contactPhone: "", contactEmail: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const invite = await api<{ stationName: string }>("/rjs/me/station-invites", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setMessage(`Invite to ${invite.stationName} saved. You can now add programmes on it.`);
      setForm({ stationName: "", city: "", contactName: "", contactPhone: "", contactEmail: "" });
      setOpen(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Invite your station">
      <p className="mt-2 text-sm text-zinc-600">
        Station not listed? Invite it. You can add your programmes on it now, and the station takes them over when it joins NowRJ.
      </p>

      {message ? <Notice kind="ok" text={message} /> : null}

      {invites.length > 0 ? (
        <ul className="mt-4 divide-y divide-zinc-100">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-semibold text-zinc-900">
                  {invite.stationName}
                  {invite.city ? <span className="font-normal text-zinc-600">, {invite.city}</span> : null}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-3 text-zinc-600">
                  {invite.contactPhone ? (
                    <span className="inline-flex items-center gap-1"><Phone size={13} aria-hidden="true" />{invite.contactPhone}</span>
                  ) : null}
                  {invite.contactEmail ? (
                    <span className="inline-flex items-center gap-1"><Mail size={13} aria-hidden="true" />{invite.contactEmail}</span>
                  ) : null}
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold capitalize text-zinc-700">
                {invite.status === "sent" ? "Waiting for station" : invite.status}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <form onSubmit={submit} className="mt-4 grid gap-4 rounded-xl bg-zinc-50 p-4 sm:grid-cols-2">
          <div>
            <label htmlFor="inv-name" className={labelClass}>Station name *</label>
            <input id="inv-name" required maxLength={150} value={form.stationName} onChange={set("stationName")} className={inputClass} />
          </div>
          <div>
            <label htmlFor="inv-city" className={labelClass}>City</label>
            <input id="inv-city" maxLength={100} value={form.city} onChange={set("city")} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="inv-contact" className={labelClass}>Contact person at the station</label>
            <input id="inv-contact" maxLength={150} value={form.contactName} onChange={set("contactName")} placeholder="Programme head, station manager…" className={inputClass} />
          </div>
          <div>
            <label htmlFor="inv-phone" className={labelClass}>Their phone</label>
            <input id="inv-phone" type="tel" maxLength={20} value={form.contactPhone} onChange={set("contactPhone")} className={inputClass} />
          </div>
          <div>
            <label htmlFor="inv-email" className={labelClass}>Their email</label>
            <input id="inv-email" type="email" maxLength={255} value={form.contactEmail} onChange={set("contactEmail")} className={inputClass} />
          </div>
          <p className="text-xs text-zinc-500 sm:col-span-2">A phone number or an email is needed so the NowRJ team can reach the station.</p>
          {error ? (
            <div className="sm:col-span-2">
              <Notice kind="error" text={error} />
            </div>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className={primaryButton}>
              {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              Save invite
            </button>
            <button type="button" onClick={() => setOpen(false)} className={quietButton}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { setOpen(true); setMessage(""); }} className={`${quietButton} mt-4`}>
          <Plus size={14} aria-hidden="true" />
          Invite a station
        </button>
      )}
    </Section>
  );
}

// --------------------------------------------------------------- programmes

function ProgrammeSection({
  current,
  openInvites,
  programmes,
  verified,
  onChanged,
}: {
  current: Affiliation | null;
  openInvites: Invite[];
  programmes: MyProgramme[];
  verified: boolean;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", where: "", startTime: "", endTime: "", callInPhone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canCreate = Boolean(current) || openInvites.length > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const [kind, id] = form.where.split(":");
    try {
      const created = await api<{ name: string; isActive: boolean }>("/rjs/me/programmes", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          stationId: kind === "station" ? id : null,
          stationInviteId: kind === "invite" ? id : null,
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          callInPhone: form.callInPhone || null,
        }),
      });
      setMessage(
        created.isActive
          ? `${created.name} is live on NowRJ.`
          : `${created.name} is saved. Listeners will see it once your profile is verified.`,
      );
      setForm({ name: "", where: "", startTime: "", endTime: "", callInPhone: "" });
      setOpen(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Your programmes">
      {message ? <Notice kind="ok" text={message} /> : null}

      {programmes.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">
          {canCreate ? "No programmes yet." : "Choose your station or invite it first, then add your programmes."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100">
          {programmes.map((programme) => (
            <ProgrammeRow key={programme.id} programme={programme} verified={verified} onChanged={onChanged} />
          ))}
        </ul>
      )}

      {open ? (
        <form onSubmit={submit} className="mt-4 grid gap-4 rounded-xl bg-zinc-50 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="p-name" className={labelClass}>Programme name *</label>
            <input id="p-name" required maxLength={150} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="p-where" className={labelClass}>Airs on *</label>
            <select id="p-where" required value={form.where} onChange={(e) => setForm((f) => ({ ...f, where: e.target.value }))} className={inputClass}>
              <option value="">Choose</option>
              {current ? <option value={`station:${current.stationId}`}>{current.stationName}</option> : null}
              {openInvites.map((invite) => (
                <option key={invite.id} value={`invite:${invite.id}`}>
                  {invite.stationName} (invited)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="p-start" className={labelClass}>Starts</label>
            <input id="p-start" type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label htmlFor="p-end" className={labelClass}>Ends</label>
            <input id="p-end" type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="p-call" className={labelClass}>Call-in number for the live show</label>
            <input id="p-call" type="tel" maxLength={20} value={form.callInPhone} onChange={(e) => setForm((f) => ({ ...f, callInPhone: e.target.value }))} placeholder="Studio number listeners call" className={inputClass} />
            <p className="mt-1 text-xs text-zinc-500">Shown publicly on the programme&apos;s Call button. Don&apos;t use a personal number.</p>
          </div>
          {error ? (
            <div className="sm:col-span-2">
              <Notice kind="error" text={error} />
            </div>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className={primaryButton}>
              {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              Save programme
            </button>
            <button type="button" onClick={() => setOpen(false)} className={quietButton}>Cancel</button>
          </div>
        </form>
      ) : canCreate ? (
        <button type="button" onClick={() => { setOpen(true); setMessage(""); }} className={`${quietButton} mt-4`}>
          <Plus size={14} aria-hidden="true" />
          Add a programme
        </button>
      ) : null}
    </Section>
  );
}

function ProgrammeRow({
  programme,
  verified,
  onChanged,
}: {
  programme: MyProgramme;
  verified: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(programme.callInPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    setBusy(true);
    try {
      await api(`/rjs/me/programmes/${programme.id}/call-in`, {
        method: "PATCH",
        body: JSON.stringify({ callInPhone: phone || null }),
      });
      setEditing(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const airsOn = programme.stationName ?? (programme.invitedStationName ? `${programme.invitedStationName} (invited)` : "—");
  const time =
    programme.startTime && programme.endTime
      ? `${programme.startTime.slice(0, 5)}–${programme.endTime.slice(0, 5)}`
      : "Time not set";

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {programme.isActive ? (
            <Link href={`/programme/${programme.slug}`} className="font-semibold text-zinc-900 hover:text-orange-700">
              {programme.name}
            </Link>
          ) : (
            <p className="font-semibold text-zinc-900">{programme.name}</p>
          )}
          <p className="text-sm text-zinc-600">
            {airsOn} · {time}
          </p>
          <p className="text-xs text-zinc-500">
            {programme.ownedByYou ? "Owned by you" : `Owned by ${programme.ownerStationName ?? "the station"}`}
            {!programme.isActive && !verified ? " · Hidden until you're verified" : ""}
          </p>
        </div>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className={quietButton}>
            <Phone size={14} aria-hidden="true" />
            {programme.callInPhone ?? "Add call-in number"}
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor={`call-${programme.id}`} className="sr-only">Call-in number</label>
          <input id={`call-${programme.id}`} type="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Studio number" className={`${inputClass} max-w-56`} />
          <button type="button" onClick={save} disabled={busy} className={primaryButton}>
            {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            Save
          </button>
          <button type="button" onClick={() => { setEditing(false); setPhone(programme.callInPhone ?? ""); setError(""); }} className={quietButton} aria-label="Cancel">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {error ? <Notice kind="error" text={error} /> : null}
    </li>
  );
}
