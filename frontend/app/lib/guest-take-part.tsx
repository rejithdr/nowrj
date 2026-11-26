"use client";

import { useState } from "react";
import { Check, LoaderCircle, Mic } from "lucide-react";
import { api, inputClass, isSignedIn, signInAndReturn } from "./ui";
import { hasContactDetails } from "./interaction";

/** "Ask to take part" in a guest recording: the listener leaves a number for the team. */
export default function GuestTakePart({ sessionId, guestName }: { sessionId: string; guestName: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function toggle() {
    setError("");
    if (!open && !(await isSignedIn())) {
      signInAndReturn();
      return;
    }
    setOpen((o) => !o);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (hasContactDetails(note)) {
      setError("Please keep phone numbers and links out of the note. Use the phone box.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/guest-sessions/${sessionId}/take-part`, { method: "POST", body: JSON.stringify({ contactPhone: phone, note: note || undefined }) });
      setDone(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p role="status" className="w-full text-sm font-semibold text-emerald-800">Sent. The team will call you if you can join {guestName}.</p>;
  return (
    <>
      <button type="button" onClick={() => void toggle()} aria-expanded={open} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-orange-50">
        <Mic size={15} aria-hidden="true" /> Ask to take part
      </button>
      {open ? (
        <form onSubmit={send} className="w-full space-y-2 rounded-xl bg-zinc-50 p-3">
          <label htmlFor={`gtp-${sessionId}`} className="block text-xs font-medium text-zinc-700">Your phone number *</label>
          <input id={`gtp-${sessionId}`} required type="tel" inputMode="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputClass} max-w-60`} />
          <label htmlFor={`gtn-${sessionId}`} className="block text-xs font-medium text-zinc-700">What would you like to say or ask? (optional)</label>
          <input id={`gtn-${sessionId}`} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
          <p className="text-xs text-zinc-600">Only the programme team sees your number. It is deleted after 30 days.</p>
          <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
            {busy ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />} Send
          </button>
        </form>
      ) : null}
      {error ? <p role="alert" className="w-full text-sm text-red-700">{error}</p> : null}
    </>
  );
}
