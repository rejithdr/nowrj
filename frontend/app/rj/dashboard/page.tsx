"use client";
import { API_URL } from "../../lib/config";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import EngagementPanel from "../../lib/engagement";
import AuthControls from "../../AuthControls";
import UpcomingShows from "../../lib/show-changes";
import SongQueue from "../../lib/song-queue";
import { RjProfileEditor } from "../../lib/rj-profile";
import { InteractionSettings } from "../../lib/interaction-settings";
import type { InteractionType } from "../../lib/interaction";
import { ReferralsPanel, VouchesPanel } from "../../lib/referrals-panel";
import {
  ArrowLeft,
  Check,
  Copy,
  MessageCircle,
  LoaderCircle,
  Mail,
  Pencil,
  Phone,
  Plus,
  Radio,
  Trash2,
  X,
} from "lucide-react";

const API = API_URL;

type RjProfile = {
  id: string;
  name: string;
  photoUrl: string | null;
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
  stationNote: string | null;
  current: boolean;
  stationId: string;
};

function affiliationText(row: Affiliation) {
  if (row.verificationStatus === "verified") return "Confirmed by the station";
  if (row.verificationStatus === "disputed") return `Disputed by the station${row.stationNote ? `: “${row.stationNote}”` : ""}`;
  return "Awaiting the station's confirmation";
}

type Invite = {
  id: string;
  stationName: string;
  city: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: string;
  expiresAt: string;
  token: string | null;
  stationApplied: boolean;
};

type Claim = {
  id: string;
  status: string;
  rjReason: string | null;
  adminReason: string | null;
  programmeName: string;
  stationName: string;
  youOwnIt: boolean;
};

type SlotDraft = { days: number[]; startTime: string; endTime: string };

type ScheduleSlot = SlotDraft & { id: string; label: string };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const emptySlot = (): SlotDraft => ({ days: [], startTime: "", endTime: "" });

type MyProgramme = {
  id: string;
  name: string;
  slug: string;
  startTime: string | null;
  endTime: string | null;
  callInPhone: string | null;
  interactionType: InteractionType;
  noticeText: string | null;
  isActive: boolean;
  stationName: string | null;
  invitedStationName: string | null;
  ownerStationName: string | null;
  ownedByYou: boolean;
  schedule: ScheduleSlot[];
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
  const [claims, setClaims] = useState<Claim[]>([]);
  const [pageError, setPageError] = useState("");

  const refresh = useCallback(async () => {
    const [h, i, p, c] = await Promise.all([
      api<Affiliation[]>("/rjs/me/stations"),
      api<Invite[]>("/rjs/me/station-invites"),
      api<MyProgramme[]>("/rjs/me/programmes"),
      api<Claim[]>("/rjs/me/claims"),
    ]);
    setHistory(h);
    setInvites(i);
    setProgrammes(p);
    setClaims(c);
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
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 hover:underline">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to NowRJ
          </Link>
          <AuthControls />
        </div>

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

        <Section title="Your profile">
          <RjProfileEditor profile={profile} onChange={(change) => setProfile((p) => (p ? { ...p, ...change } : p))} />
        </Section>

        {profile.verificationStatus === "pending" ? (
          <Section title="Get verified faster">
            <VouchesPanel />
          </Section>
        ) : null}

        <Section title="Song requests & questions">
          <SongQueue />
        </Section>

        <Section title="Your engagement">
          <EngagementPanel path="/shows/engagement/rj" showHosts={false} />
        </Section>

        <StationSection stations={stations} current={current} history={history} onChanged={refresh} />
        <ClaimsSection claims={claims} onChanged={refresh} />
        <Section title="Your referral link">
          <ReferralsPanel />
        </Section>
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
              {affiliationText(current)}
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
              <li key={row.id} className="py-2">
                <div className="flex justify-between gap-3">
                  <span className="text-zinc-900">{row.stationName}</span>
                  <span className="text-zinc-600">
                    {formatDate(row.joinedOn)} – {row.leftOn ? formatDate(row.leftOn) : "present"}
                  </span>
                </div>
                <p className={`text-xs ${row.verificationStatus === "disputed" ? "text-red-700" : "text-zinc-500"}`}>{affiliationText(row)}</p>
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
                {invite.status === "accepted"
                  ? "Joined NowRJ"
                  : invite.status !== "sent"
                    ? invite.status
                    : invite.stationApplied
                      ? "Station applied · being verified"
                      : "Waiting for station"}
              </span>
              {invite.token && !invite.stationApplied ? <InviteLink invite={invite} /> : null}
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

function InviteLink({ invite }: { invite: Invite }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/station/join/${invite.token}`;
  const text = `Hi! I've added our programmes on NowRJ. Please join as ${invite.stationName} so you can manage them: ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this invite link:", link);
    }
  }

  const phone = invite.contactPhone?.replace(/[^0-9]/g, "");
  return (
    <div className="flex w-full flex-wrap gap-2">
      <button type="button" onClick={() => void copy()} className={quietButton}>
        <Copy size={14} aria-hidden="true" />
        {copied ? "Copied" : "Copy invite link"}
      </button>
      <a
        href={`https://wa.me/${phone && phone.length >= 10 ? (phone.length === 10 ? `91${phone}` : phone) : ""}?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={quietButton}
      >
        <MessageCircle size={14} aria-hidden="true" />
        Send on WhatsApp
      </a>
    </div>
  );
}

// ------------------------------------------------------------------- claims

const claimStatusText: Record<string, string> = {
  awaiting_rj: "Waiting for you",
  approved_by_rj: "You approved · station owns it",
  rejected_by_rj: "You declined · NowRJ team reviewing",
  approved_by_admin: "NowRJ team gave it to the station",
  rejected_by_admin: "NowRJ team kept it with you",
};

function ClaimsSection({ claims, onChanged }: { claims: Claim[]; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (claims.length === 0) return null;

  async function decide(claim: Claim, approve: boolean) {
    let body: string | undefined;
    if (approve) {
      if (!window.confirm(`Hand ${claim.programmeName} over to ${claim.stationName}? The programme, its name and its history will belong to the station. Your followers stay with you.`)) return;
    } else {
      const reason = window.prompt(`Why are you declining ${claim.stationName}'s claim on ${claim.programmeName}? The NowRJ team will review it.`);
      if (!reason) return;
      body = JSON.stringify({ reason });
    }
    setBusy(claim.id);
    setError("");
    try {
      await api(`/rjs/me/claims/${claim.id}/${approve ? "approve" : "reject"}`, { method: "POST", body });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title="Station claims">
      <p className="mt-2 text-sm text-zinc-600">A station that joined NowRJ is asking to take over a programme you created.</p>
      {error ? <Notice kind="error" text={error} /> : null}
      <ul className="mt-3 divide-y divide-zinc-100">
        {claims.map((claim) => (
          <li key={claim.id} className="py-3">
            <p className="font-semibold text-zinc-900">
              {claim.stationName} → {claim.programmeName}
            </p>
            <p className="text-sm text-zinc-600">
              {claimStatusText[claim.status] ?? claim.status}
              {claim.rjReason ? ` · your reason: “${claim.rjReason}”` : ""}
            </p>
            {claim.status === "awaiting_rj" && claim.youOwnIt ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={busy === claim.id} onClick={() => void decide(claim, true)} className={primaryButton}>
                  <Check size={16} aria-hidden="true" /> Approve
                </button>
                <button type="button" disabled={busy === claim.id} onClick={() => void decide(claim, false)} className={quietButton}>
                  <X size={14} aria-hidden="true" /> Decline
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// --------------------------------------------------------------- schedules

function SlotEditor({
  slot,
  index,
  onChange,
  onRemove,
}: {
  slot: SlotDraft;
  index: number;
  onChange: (slot: SlotDraft) => void;
  onRemove?: () => void;
}) {
  const toggle = (day: number) =>
    onChange({
      ...slot,
      days: slot.days.includes(day) ? slot.days.filter((d) => d !== day) : [...slot.days, day].sort(),
    });
  const preset = (days: number[]) => onChange({ ...slot, days });

  return (
    <fieldset className="rounded-xl border border-zinc-200 bg-white p-3">
      <legend className="px-1 text-xs font-semibold text-zinc-600">Time slot {index + 1}</legend>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days it airs">
        {DAYS.map((name, i) => {
          const day = i + 1;
          const on = slot.days.includes(day);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(day)}
              className={`min-h-9 min-w-11 rounded-full border px-2.5 text-sm font-semibold ${
                on ? "border-orange-600 bg-orange-600 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-orange-300"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <button type="button" onClick={() => preset([1, 2, 3, 4, 5])} className="font-semibold text-orange-700 hover:underline">Weekdays</button>
        <button type="button" onClick={() => preset([6, 7])} className="font-semibold text-orange-700 hover:underline">Weekend</button>
        <button type="button" onClick={() => preset([1, 2, 3, 4, 5, 6, 7])} className="font-semibold text-orange-700 hover:underline">Every day</button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`slot-${index}-start`} className="mb-1 block text-xs font-medium text-zinc-700">Starts</label>
          <input id={`slot-${index}-start`} type="time" required value={slot.startTime} onChange={(e) => onChange({ ...slot, startTime: e.target.value })} className={`${inputClass} w-36`} />
        </div>
        <div>
          <label htmlFor={`slot-${index}-end`} className="mb-1 block text-xs font-medium text-zinc-700">Ends</label>
          <input id={`slot-${index}-end`} type="time" required value={slot.endTime} onChange={(e) => onChange({ ...slot, endTime: e.target.value })} className={`${inputClass} w-36`} />
        </div>
        {onRemove ? (
          <button type="button" onClick={onRemove} className={quietButton} aria-label={`Remove time slot ${index + 1}`}>
            <Trash2 size={14} aria-hidden="true" />
            Remove
          </button>
        ) : null}
      </div>
    </fieldset>
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
  const [form, setForm] = useState({ name: "", where: "", callInPhone: "" });
  const [slots, setSlots] = useState<SlotDraft[]>([emptySlot()]);
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
          schedule: slots,
          callInPhone: form.callInPhone || null,
        }),
      });
      setMessage(
        created.isActive
          ? `${created.name} is live on NowRJ.`
          : `${created.name} is saved. Listeners will see it once your profile is verified.`,
      );
      setForm({ name: "", where: "", callInPhone: "" });
      setSlots([emptySlot()]);
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
            <ProgrammeRow key={programme.id} programme={programme} verified={verified} current={current} onChanged={onChanged} />
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
          <div className="space-y-3 sm:col-span-2">
            <p className={labelClass}>When it airs *</p>
            {slots.map((slot, index) => (
              <SlotEditor
                key={index}
                slot={slot}
                index={index}
                onChange={(next) => setSlots((all) => all.map((s, i) => (i === index ? next : s)))}
                onRemove={slots.length > 1 ? () => setSlots((all) => all.filter((_, i) => i !== index)) : undefined}
              />
            ))}
            <button type="button" onClick={() => setSlots((all) => [...all, emptySlot()])} className={quietButton}>
              <Plus size={14} aria-hidden="true" />
              Add another time
            </button>
            <p className="text-xs text-zinc-500">Use another time slot when the show airs at a different time on other days, for example a weekend edition. An end time before the start means the show runs past midnight.</p>
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
  current,
  onChanged,
}: {
  programme: MyProgramme;
  verified: boolean;
  current: Affiliation | null;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const airsOn = programme.stationName ?? (programme.invitedStationName ? `${programme.invitedStationName} (invited)` : "—");
  const time = programme.schedule.length
    ? programme.schedule.map((slot) => slot.label).join(" · ")
    : "Schedule not set";

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
          <p className="text-sm text-zinc-600">
            <Phone size={13} className="mr-1 inline" aria-hidden="true" />
            {programme.callInPhone ?? "No call-in number"}
          </p>
          <p className="text-sm text-zinc-600">
            Listeners can: {programme.interactionType === "question" ? "Ask a question" : "Request a song"}
          </p>
          <p className="text-xs text-zinc-500">
            {programme.ownedByYou ? "Owned by you" : `Owned by ${programme.ownerStationName ?? "the station"}`}
            {!programme.isActive && !verified ? " · Hidden until you're verified" : ""}
          </p>
        </div>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className={quietButton}>
            <Pencil size={14} aria-hidden="true" />
            Edit programme
          </button>
        ) : null}
      </div>
      {editing ? (
        <ProgrammeForm
          programme={programme}
          onDone={async (saved) => {
            setEditing(false);
            if (saved) await onChanged();
          }}
        />
      ) : null}
      {!editing && !programme.stationName && programme.ownedByYou && current ? (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm(`Move ${programme.name} to ${current.stationName}? Use this if ${current.stationName} is the station you invited. You stay the owner until the station claims it.`)) return;
            setBusy(true);
            setError("");
            try {
              await api(`/rjs/me/programmes/${programme.id}/move-to-station`, { method: "POST" });
              await onChanged();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not move the programme.");
            } finally {
              setBusy(false);
            }
          }}
          className={`${quietButton} mt-2`}
        >
          Move to {current.stationName}
        </button>
      ) : null}
      {error ? <Notice kind="error" text={error} /> : null}
      {programme.schedule.length && !editing ? <UpcomingShows programmeId={programme.id} /> : null}
    </li>
  );
}

/** Name, call-in number and weekly time slots, saved together with one button. */
function ProgrammeForm({ programme, onDone }: { programme: MyProgramme; onDone: (saved: boolean) => Promise<void> }) {
  const [name, setName] = useState(programme.name);
  const [phone, setPhone] = useState(programme.callInPhone ?? "");
  const [type, setType] = useState<InteractionType>(programme.interactionType ?? "song");
  const [notice, setNotice] = useState(programme.noticeText ?? "");
  const [slots, setSlots] = useState<SlotDraft[]>(
    programme.schedule.length
      ? programme.schedule.map((s) => ({ days: [...s.days], startTime: s.startTime.slice(0, 5), endTime: s.endTime.slice(0, 5) }))
      : [emptySlot()],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(`/rjs/me/programmes/${programme.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          callInPhone: phone || null,
          schedule: slots,
          interactionType: type,
          noticeText: notice.trim() || null,
        }),
      });
      await onDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-4 rounded-xl bg-zinc-50 p-4">
      <div>
        <label htmlFor={`name-${programme.id}`} className={labelClass}>Programme name</label>
        <input id={`name-${programme.id}`} required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        <p className="mt-1 text-xs text-zinc-500">The programme&apos;s link stays the same when you rename it.</p>
      </div>
      <div className="space-y-3">
        <p className={labelClass}>When it airs</p>
        {slots.map((slot, index) => (
          <SlotEditor
            key={index}
            slot={slot}
            index={index}
            onChange={(next) => setSlots((all) => all.map((s, i) => (i === index ? next : s)))}
            onRemove={slots.length > 1 ? () => setSlots((all) => all.filter((_, i) => i !== index)) : undefined}
          />
        ))}
        <button type="button" onClick={() => setSlots((all) => [...all, emptySlot()])} className={quietButton}>
          <Plus size={14} aria-hidden="true" />
          Add another time
        </button>
        <p className="text-xs text-zinc-500">Changes to the times apply from today. Past shows keep their times. An end time before the start means the show runs past midnight.</p>
      </div>
      <div>
        <label htmlFor={`call-${programme.id}`} className={labelClass}>Call-in number for the live show</label>
        <input id={`call-${programme.id}`} type="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Studio number listeners call" className={`${inputClass} max-w-64`} />
      </div>
      <InteractionSettings id={programme.id} type={type} notice={notice} onType={setType} onNotice={setNotice} />
      {error ? <Notice kind="error" text={error} /> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
          Save changes
        </button>
        <button type="button" disabled={busy} onClick={() => void onDone(false)} className={quietButton}>Cancel</button>
      </div>
    </form>
  );
}
