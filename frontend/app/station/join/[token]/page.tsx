"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { Check, LoaderCircle, Radio } from "lucide-react";
import { api, Card, inputClass, isSignedIn, labelClass, Notice, primaryButton, signInAndReturn } from "../../../lib/ui";

type Invite = {
  stationName: string;
  city: string | null;
  invitedBy: string;
  status: string;
  expired: boolean;
  appliedStation: { name: string; verificationStatus: string } | null;
};

type Station = { id: string; name: string; city: string | null; isActive: boolean };

export default function StationJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [form, setForm] = useState({ name: "", city: "", state: "", reach: "", contactPhone: "", contactEmail: "", stationId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await api<Invite>(`/station-invites/${token}`);
        setInvite(data);
        setForm((f) => ({ ...f, name: data.stationName, city: data.city ?? "" }));
        setSignedIn(await isSignedIn());
        const list = await api<Station[]>("/stations");
        setStations(list.filter((s) => s.isActive));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this invite.");
      }
    }
    void load();
  }, [token]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await api<{ stationName: string }>(`/station-invites/${token}/join`, {
        method: "POST",
        body: JSON.stringify(mode === "existing" ? { mode, stationId: form.stationId } : { mode, ...form }),
      });
      setDone(result.stationName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your application.");
    } finally {
      setBusy(false);
    }
  }

  const unusable = invite && (invite.status !== "sent" || invite.expired || invite.appliedStation);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">
          Now<span className="text-orange-600">RJ</span>
        </Link>

        {!invite && !error ? (
          <p className="mt-8 text-zinc-600">
            <LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />
            Loading invite…
          </p>
        ) : null}

        {invite ? (
          <header className="mt-8 flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
              <Radio size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">Station invite</p>
              <h1 className="mt-1 text-2xl font-bold text-zinc-900">
                {invite.invitedBy} invited {invite.stationName} to NowRJ
              </h1>
              <p className="mt-2 text-zinc-600">
                NowRJ connects your RJs and programmes with their listeners. Join to manage your station&apos;s programmes, approve ads and see engagement.
              </p>
            </div>
          </header>
        ) : null}

        {error && !invite ? <Notice kind="error" text={error} /> : null}

        {done ? (
          <Card>
            <h2 className="text-lg font-bold text-zinc-900">Application sent</h2>
            <p className="mt-2 text-zinc-700">
              The NowRJ team will verify {done} and confirm you as its representative. Until then the station stays hidden from listeners.
            </p>
            <Link href="/station/dashboard" className={`${primaryButton} mt-5`}>Go to station dashboard</Link>
          </Card>
        ) : invite && unusable ? (
          <Notice
            kind="info"
            text={
              invite.expired
                ? "This invite has expired. Ask the RJ to send a new one."
                : invite.appliedStation
                  ? `${invite.appliedStation.name} has already applied with this invite and is being reviewed by the NowRJ team.`
                  : "This invite has already been used."
            }
          />
        ) : invite && signedIn === false ? (
          <Card>
            <p className="text-zinc-700">Sign in to apply as the representative of {invite.stationName}.</p>
            <button type="button" onClick={signInAndReturn} className={`${primaryButton} mt-4`}>Sign in with Google</button>
          </Card>
        ) : invite && signedIn ? (
          <Card title="Apply as the station's representative">
            <fieldset className="mt-4">
              <legend className="sr-only">Is the station already on NowRJ?</legend>
              <div className="flex flex-col gap-2 sm:flex-row">
                {(["new", "existing"] as const).map((value) => (
                  <label key={value} className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${mode === value ? "border-orange-500 bg-orange-50" : "border-zinc-200"}`}>
                    <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
                    {value === "new" ? "Our station is new to NowRJ" : "Our station is already listed"}
                  </label>
                ))}
              </div>
            </fieldset>

            <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
              {mode === "existing" ? (
                <div className="sm:col-span-2">
                  <label htmlFor="station" className={labelClass}>Your station</label>
                  <select id="station" required value={form.stationId} onChange={set("stationId")} className={inputClass}>
                    <option value="">Choose your station</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}{s.city ? `, ${s.city}` : ""}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <label htmlFor="name" className={labelClass}>Official station name *</label>
                    <input id="name" required maxLength={150} value={form.name} onChange={set("name")} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="city" className={labelClass}>City</label>
                    <input id="city" maxLength={100} value={form.city} onChange={set("city")} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="state" className={labelClass}>State</label>
                    <input id="state" maxLength={100} value={form.state} onChange={set("state")} className={inputClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="reach" className={labelClass}>Reach</label>
                    <select id="reach" value={form.reach} onChange={set("reach")} className={inputClass}>
                      <option value="">Not sure</option>
                      <option value="national">National network</option>
                      <option value="local">Local station</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="phone" className={labelClass}>Station phone</label>
                    <input id="phone" type="tel" maxLength={20} value={form.contactPhone} onChange={set("contactPhone")} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="email" className={labelClass}>Station email</label>
                    <input id="email" type="email" maxLength={255} value={form.contactEmail} onChange={set("contactEmail")} className={inputClass} />
                  </div>
                  <p className="text-xs text-zinc-500 sm:col-span-2">
                    The NowRJ team uses these to verify the station. They are never shown publicly.
                  </p>
                </>
              )}
              {error ? <div className="sm:col-span-2"><Notice kind="error" text={error} /></div> : null}
              <div className="sm:col-span-2">
                <button type="submit" disabled={busy} className={primaryButton}>
                  {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                  Send application
                </button>
              </div>
            </form>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
