"use client";

import { useEffect, useState } from "react";
import { Check, Hand, LoaderCircle, MessageSquare, Phone, Send, ShieldCheck } from "lucide-react";
import { api, inputClass, isSignedIn, signInAndReturn } from "./ui";
import { hasContactDetails } from "./interaction";

type Reply = { id: string; fromBusiness: boolean; body: string; createdAt: string };
type Lead = { id: string; kind: "phone" | "message"; message: string | null; phoneShared: boolean; status: string; withdrawnAt: string | null; createdAt: string; businessName: string; replies: Reply[] };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const chip = (on: boolean) =>
  `inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${on ? "border-orange-500 bg-orange-50 text-orange-800" : "border-zinc-300 bg-white text-zinc-700 hover:bg-orange-50"}`;

/**
 * "I'm interested" on an ad: share your number with the business (after
 * agreeing), or message them inside NowRJ without sharing it.
 */
export default function AdInterest({ adId, businessName, showId }: { adId: string; businessName: string; showId: string | null }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"phone" | "message">("phone");
  const [phone, setPhone] = useState("");
  const [agree, setAgree] = useState(false);
  const [message, setMessage] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const yes = await isSignedIn();
      setSignedIn(yes);
      if (yes) {
        try {
          setLead((await api<{ lead: Lead | null }>(`/ads/${adId}/lead`)).lead);
        } catch {
          // The ad still works without this.
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [adId]);

  async function start() {
    setError("");
    if (!signedIn) {
      signInAndReturn();
      return;
    }
    setOpen(true);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (hasContactDetails(message)) {
      setError(kind === "phone" ? "Put your number in the phone box, not in the note." : "Please remove phone numbers, emails and links. Choose “Share my number” if you want a call.");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ lead: Lead }>(`/ads/${adId}/lead`, {
        method: "POST",
        body: JSON.stringify(kind === "phone" ? { kind, phone, agree, message: message || undefined, showId } : { kind, message, showId }),
      });
      setLead(res.lead);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendFollowUp(event: React.FormEvent) {
    event.preventDefault();
    if (!lead || !followUp.trim()) return;
    if (hasContactDetails(followUp)) {
      setError("Please remove phone numbers, emails and links.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const reply = await api<Reply>(`/ad-leads/${lead.id}/messages`, { method: "POST", body: JSON.stringify({ body: followUp }) });
      setLead({ ...lead, replies: [...lead.replies, reply] });
      setFollowUp("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!lead) return;
    if (!window.confirm(`Stop this enquiry? ${lead.phoneShared ? `Your number is removed from ${businessName}'s list now, and` : ""} they can no longer message you here.`)) return;
    setBusy(true);
    try {
      await api(`/ad-leads/${lead.id}`, { method: "DELETE" });
      setLead({ ...lead, withdrawnAt: new Date().toISOString(), phoneShared: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop it.");
    } finally {
      setBusy(false);
    }
  }

  if (lead) {
    return (
      <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4" aria-label={`Your enquiry with ${businessName}`}>
        <p className="flex items-center gap-1.5 font-semibold text-emerald-900">
          <Check size={16} aria-hidden="true" />
          {lead.withdrawnAt ? "You stopped this enquiry." : lead.kind === "phone" ? `${businessName} has your number and will call you.` : `Your message went to ${businessName}.`}
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {lead.message ? (
            <li className="ml-8 rounded-lg bg-white p-2 text-zinc-800">
              <span className="block text-xs text-zinc-500">You · {when(lead.createdAt)}</span>
              {lead.message}
            </li>
          ) : null}
          {lead.replies.map((r) => (
            <li key={r.id} className={`rounded-lg p-2 ${r.fromBusiness ? "mr-8 border-l-4 border-orange-300 bg-white" : "ml-8 bg-white"}`}>
              <span className="block text-xs text-zinc-500">{r.fromBusiness ? businessName : "You"} · {when(r.createdAt)}</span>
              <span className="text-zinc-900">{r.body}</span>
            </li>
          ))}
        </ul>
        {!lead.withdrawnAt ? (
          <>
            <form onSubmit={sendFollowUp} className="mt-3 flex gap-2">
              <label htmlFor={`fu-${adId}`} className="sr-only">Message {businessName}</label>
              <input id={`fu-${adId}`} maxLength={500} value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder={`Message ${businessName}…`} className={inputClass} />
              <button type="submit" disabled={busy || !followUp.trim()} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
                <Send size={15} aria-hidden="true" /> Send
              </button>
            </form>
            <button type="button" disabled={busy} onClick={() => void withdraw()} className="mt-3 text-xs font-semibold text-zinc-600 underline">
              {lead.phoneShared ? "Remove my number and stop" : "Stop this enquiry"}
            </button>
          </>
        ) : null}
        {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
      </section>
    );
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button type="button" onClick={() => void start()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-orange-600 bg-white px-4 font-semibold text-orange-700 hover:bg-orange-50">
          <Hand size={18} aria-hidden="true" /> I&apos;m interested
        </button>
      ) : (
        <form onSubmit={send} className="space-y-3 rounded-xl border border-orange-200 bg-orange-50/40 p-4">
          <p className="font-semibold text-zinc-900">How should {businessName} reach you?</p>
          <div className="flex gap-2" role="radiogroup" aria-label="How to be contacted">
            <button type="button" role="radio" aria-checked={kind === "phone"} onClick={() => setKind("phone")} className={chip(kind === "phone")}>
              <Phone size={15} aria-hidden="true" /> Share my number
            </button>
            <button type="button" role="radio" aria-checked={kind === "message"} onClick={() => setKind("message")} className={chip(kind === "message")}>
              <MessageSquare size={15} aria-hidden="true" /> Message only
            </button>
          </div>
          {kind === "phone" ? (
            <>
              <div>
                <label htmlFor={`ph-${adId}`} className="mb-1 block text-sm font-medium text-zinc-800">Your phone number *</label>
                <input id={`ph-${adId}`} required type="tel" inputMode="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputClass} max-w-60`} />
              </div>
              <div>
                <label htmlFor={`note-${adId}`} className="mb-1 block text-sm font-medium text-zinc-800">What are you looking for? (optional)</label>
                <input id={`note-${adId}`} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
              </div>
              <label className="flex cursor-pointer gap-2 rounded-lg border border-emerald-200 bg-white p-2.5 text-sm text-zinc-800">
                <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-orange-600" />
                <span>
                  I agree that NowRJ shares my name and this number with <strong>{businessName}</strong> so they can contact me about this offer.
                </span>
              </label>
              <p className="flex gap-1.5 text-xs text-zinc-600">
                <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                Only {businessName} sees it. It is deleted after 90 days, or straight away if you stop the enquiry.
              </p>
            </>
          ) : (
            <div>
              <label htmlFor={`msg-${adId}`} className="mb-1 block text-sm font-medium text-zinc-800">Your message *</label>
              <textarea id={`msg-${adId}`} required maxLength={300} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className={`${inputClass} py-2`} placeholder="Ask about price, stock, timings…" />
              <p className="mt-1 text-xs text-zinc-600">{businessName} replies here in NowRJ. Your number is not shared.</p>
            </div>
          )}
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || (kind === "phone" && !agree)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-5 font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
              {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />} Send to {businessName}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-3 text-sm font-semibold text-zinc-600">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
