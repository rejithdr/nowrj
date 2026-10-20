"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Check, LoaderCircle, Megaphone, Radio } from "lucide-react";
import AuthControls from "../AuthControls";
import { api, Card, inputClass, isSignedIn, labelClass, Notice, primaryButton, signInAndReturn } from "../lib/ui";

type Station = { id: string; name: string; city: string | null; isActive: boolean };

const benefits = [
  { icon: Radio, title: "Own your programmes", text: "Claim the shows your RJs created and manage their call-in numbers." },
  { icon: BarChart3, title: "See engagement", text: "Likes, Fires, call taps and song requests for every show." },
  { icon: Megaphone, title: "Earn from ads", text: "Approve advertisers' click-to-ad links through Now On FM. Coming soon." },
];

/** Stations apply to join NowRJ directly, without an RJ's invite. */
export default function ForStationsPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [form, setForm] = useState({ name: "", city: "", state: "", reach: "", contactPhone: "", contactEmail: "", stationId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    isSignedIn().then(setSignedIn).catch(() => setSignedIn(false));
    api<Station[]>("/stations")
      .then((list) => setStations(list.filter((s) => s.isActive)))
      .catch(() => undefined);
  }, []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await api<{ stationName: string }>("/station-applications", {
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

  return (
    <main className="bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">
            Now<span className="text-orange-600">RJ</span>
          </Link>
          <AuthControls />
        </header>

        <section className="py-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">For radio stations</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">Bring your listeners closer to your shows</h1>
          <p className="mt-3 max-w-xl leading-6 text-zinc-600">
            Your RJs and programmes on NowRJ, with live reactions, song requests and call-ins from listeners, and the numbers to show it.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {benefits.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-xl border border-zinc-200 bg-white p-4">
                <Icon size={20} className="text-orange-600" aria-hidden="true" />
                <p className="mt-2 font-semibold text-zinc-900">{title}</p>
                <p className="mt-1 text-sm text-zinc-600">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        {done ? (
          <Card>
            <h2 className="text-lg font-bold text-zinc-900">Application sent</h2>
            <p className="mt-2 text-zinc-700">The NowRJ team will verify {done} and confirm you as its representative.</p>
            <Link href="/station/dashboard" className={`${primaryButton} mt-5`}>Go to station dashboard</Link>
          </Card>
        ) : signedIn === false ? (
          <Card title="Apply to join">
            <p className="mt-2 text-zinc-700">Sign in with the Google account you&apos;ll use to manage the station.</p>
            <button type="button" onClick={signInAndReturn} className={`${primaryButton} mt-4`}>Sign in with Google</button>
          </Card>
        ) : signedIn ? (
          <Card title="Apply to join">
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
                  <p className="text-xs text-zinc-500 sm:col-span-2">The NowRJ team uses these to verify the station. They are never shown publicly.</p>
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
        <p className="mt-6 pb-8 text-sm text-zinc-600">
          Already invited by one of your RJs? Use the link they sent you instead. It brings the programmes they added with it.
        </p>
      </div>
    </main>
  );
}
