"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeIndianRupee, CheckCircle2, LoaderCircle, MousePointerClick, Radio } from "lucide-react";
import AuthControls from "../AuthControls";
import { api, inputClass, labelClass, Notice, primaryButton } from "../lib/ui";
import { CONTACT_EMAIL } from "../lib/legal";

const points = [
  { icon: Radio, title: "Ads that air with the show", text: "Your ad plays on the programme; listeners then find its link right on the programme's NowRJ page." },
  { icon: MousePointerClick, title: "Pay only for clicks", text: "Prepaid clicks from a wallet. Repeat clicks are not charged twice." },
  { icon: BadgeIndianRupee, title: "Approved by the station", text: "Every link is checked by the station that airs it, and stays live for 72 hours after the show." },
];

/** "Advertise on Now On FM": what is coming, and a contact form for the Super Admin. */
export default function AdvertisePage() {
  const [form, setForm] = useState({ name: "", organisation: "", phone: "", email: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/enquiries", { method: "POST", body: JSON.stringify(form) });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send. Please try again.");
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

        <section className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">Now On FM · coming soon</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">Advertise on the shows people are listening to</h1>
          <p className="mt-3 max-w-xl leading-6 text-zinc-600">
            Now On FM connects advertisers and agencies with radio stations and their programmes on NowRJ. It is launching soon;
            tell us about your brand and we&apos;ll get in touch.
          </p>
        </section>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {points.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <Icon size={22} className="text-orange-600" aria-hidden="true" />
              <h2 className="mt-2 font-bold text-zinc-900">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">{text}</p>
            </div>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-zinc-900">Talk to us</h2>
          {sent ? (
            <div className="mt-4 flex items-start gap-3 text-zinc-700">
              <CheckCircle2 size={22} className="shrink-0 text-emerald-600" aria-hidden="true" />
              <p>Thank you. Your message has reached the Now On FM team, and we&apos;ll reply within two working days.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="e-name" className={labelClass}>Your name *</label>
                <input id="e-name" required maxLength={100} value={form.name} onChange={set("name")} className={inputClass} autoComplete="name" />
              </div>
              <div>
                <label htmlFor="e-org" className={labelClass}>Company or agency</label>
                <input id="e-org" maxLength={150} value={form.organisation} onChange={set("organisation")} className={inputClass} autoComplete="organization" />
              </div>
              <div>
                <label htmlFor="e-phone" className={labelClass}>Phone</label>
                <input id="e-phone" type="tel" maxLength={20} value={form.phone} onChange={set("phone")} className={inputClass} autoComplete="tel" />
              </div>
              <div>
                <label htmlFor="e-email" className={labelClass}>Email</label>
                <input id="e-email" type="email" maxLength={255} value={form.email} onChange={set("email")} className={inputClass} autoComplete="email" />
              </div>
              <p className="-mt-2 text-xs text-zinc-500 sm:col-span-2">Give a phone number or an email, or both.</p>
              <div className="sm:col-span-2">
                <label htmlFor="e-msg" className={labelClass}>What would you like to advertise? *</label>
                <textarea id="e-msg" required maxLength={1000} rows={4} value={form.message} onChange={set("message")} className={`${inputClass} py-2`} />
              </div>
              <div className="hidden" aria-hidden="true">
                <label htmlFor="e-site">Website</label>
                <input id="e-site" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
              </div>
              {error ? <div className="sm:col-span-2"><Notice kind="error" text={error} /></div> : null}
              <div className="sm:col-span-2">
                <button type="submit" disabled={busy} className={primaryButton}>
                  {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
                  Send
                </button>
                <p className="mt-3 text-sm text-zinc-600">
                  Or email <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-orange-700 underline">{CONTACT_EMAIL}</a>.
                  We use your details only to reply; see our <a href="/privacy" className="underline">Privacy Policy</a>.
                </p>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
