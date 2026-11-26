"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, Mic, ShieldCheck, UserPlus } from "lucide-react";
import { api, inputClass, isSignedIn, signInAndReturn } from "./ui";
import { hasContactDetails } from "./interaction";

type Mine = { id: string; kind: "take_part" | "nominate"; note: string | null; nomineeName: string | null; status: string; guestSessionId: string | null; createdAt: string };
type Info = { mode: "off" | "take_part" | "nominate" | "both"; prompt: string | null; mine: Mine[] };

const STATUS: Record<string, string> = {
  new: "Sent",
  contacted: "The team has been in touch",
  agreed: "Confirmed ✓",
  declined: "Not this time",
  done: "On air ✓",
};

const chip = (on: boolean) =>
  `inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${on ? "border-orange-500 bg-orange-50 text-orange-800" : "border-zinc-300 bg-white text-zinc-700 hover:bg-orange-50"}`;

/**
 * "Take part" and "Nominate someone" on a programme page, when the programme
 * invites them. The phone numbers go only to the programme team.
 */
export default function TakePart({ programmeId, programmeName }: { programmeId: string; programmeName: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState<"take_part" | "nominate" | null>(null);
  const [form, setForm] = useState({ note: "", contactPhone: "", nomineeName: "", nomineePhone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  const load = useCallback(async () => {
    try {
      setInfo(await api<Info>(`/programmes/${programmeId}/participation`));
    } catch {
      setInfo(null);
    }
  }, [programmeId]);

  useEffect(() => {
    // Loaded after the first paint (not inside the effect body).
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!info || info.mode === "off") return null;
  const can = (k: "take_part" | "nominate") => info.mode === "both" || info.mode === k;

  async function choose(k: "take_part" | "nominate") {
    setError("");
    setSent("");
    if (!(await isSignedIn())) {
      signInAndReturn();
      return;
    }
    setOpen((o) => (o === k ? null : k));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!open) return;
    setError("");
    if ([form.note, form.nomineeName].some(hasContactDetails)) {
      setError("Please keep phone numbers, emails and links out of the text. Use the phone boxes.");
      return;
    }
    setBusy(true);
    try {
      await api(`/programmes/${programmeId}/participation`, {
        method: "POST",
        body: JSON.stringify(
          open === "nominate"
            ? { kind: "nominate", nomineeName: form.nomineeName, nomineePhone: form.nomineePhone, note: form.note || undefined, contactPhone: form.contactPhone || undefined }
            : { kind: "take_part", note: form.note || undefined, contactPhone: form.contactPhone },
        ),
      });
      setSent(open === "nominate" ? `Thanks! The ${programmeName} team will call ${form.nomineeName} first.` : `Sent. The ${programmeName} team will call you if you're picked.`);
      setForm({ note: "", contactPhone: "", nomineeName: "", nomineePhone: "" });
      setOpen(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="take-part" className="mt-6 rounded-2xl border border-orange-200 bg-orange-50/40 p-5">
      <h2 className="text-lg font-bold text-zinc-900">Be on the show</h2>
      {info.prompt ? <p className="mt-1 text-zinc-700">{info.prompt}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {can("take_part") ? (
          <button type="button" onClick={() => void choose("take_part")} aria-expanded={open === "take_part"} className={chip(open === "take_part")}>
            <Mic size={16} aria-hidden="true" /> Take part
          </button>
        ) : null}
        {can("nominate") ? (
          <button type="button" onClick={() => void choose("nominate")} aria-expanded={open === "nominate"} className={chip(open === "nominate")}>
            <UserPlus size={16} aria-hidden="true" /> Nominate someone
          </button>
        ) : null}
      </div>

      {open ? (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl bg-white p-4">
          {open === "nominate" ? (
            <>
              <div>
                <label htmlFor="nominee-name" className="mb-1 block text-sm font-medium text-zinc-800">Their name *</label>
                <input id="nominee-name" required maxLength={100} value={form.nomineeName} onChange={(e) => setForm((f) => ({ ...f, nomineeName: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label htmlFor="nominee-phone" className="mb-1 block text-sm font-medium text-zinc-800">Their phone number *</label>
                <input id="nominee-phone" required type="tel" inputMode="tel" maxLength={20} value={form.nomineePhone} onChange={(e) => setForm((f) => ({ ...f, nomineePhone: e.target.value }))} className={`${inputClass} max-w-60`} />
              </div>
              <div>
                <label htmlFor="nominee-why" className="mb-1 block text-sm font-medium text-zinc-800">Why them? (optional)</label>
                <textarea id="nominee-why" maxLength={300} rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className={`${inputClass} py-2`} />
              </div>
              <div>
                <label htmlFor="nominator-phone" className="mb-1 block text-sm font-medium text-zinc-800">Your phone number (optional, if the team needs to check with you)</label>
                <input id="nominator-phone" type="tel" inputMode="tel" maxLength={20} value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} className={`${inputClass} max-w-60`} />
              </div>
              <p className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-emerald-900">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Only the programme team sees their number, and it is deleted after 30 days. Nothing goes on air unless they agree. Please nominate only people who
                  would enjoy it.
                </span>
              </p>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="tp-phone" className="mb-1 block text-sm font-medium text-zinc-800">Your phone number *</label>
                <input id="tp-phone" required type="tel" inputMode="tel" maxLength={20} value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} className={`${inputClass} max-w-60`} />
              </div>
              <div>
                <label htmlFor="tp-note" className="mb-1 block text-sm font-medium text-zinc-800">Tell the team about you (optional)</label>
                <textarea id="tp-note" maxLength={300} rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className={`${inputClass} py-2`} />
              </div>
              <p className="text-xs text-zinc-600">Only the programme team sees your number. It is deleted after 30 days.</p>
            </>
          )}
          <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-orange-600 px-5 font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
            {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            {open === "nominate" ? "Send nomination" : "Send"}
          </button>
        </form>
      ) : null}

      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      {sent ? <p role="status" className="mt-3 text-sm font-semibold text-emerald-800">{sent}</p> : null}

      {info.mine.length ? (
        <ul className="mt-4 space-y-1 border-t border-orange-100 pt-3 text-sm">
          {info.mine.map((m) => (
            <li key={m.id} className="flex justify-between gap-2">
              <span className="text-zinc-800">
                {m.kind === "nominate" ? `You nominated ${m.nomineeName}` : m.guestSessionId ? "You asked to join a guest recording" : "You asked to take part"}
              </span>
              <span className={m.status === "agreed" || m.status === "done" ? "font-semibold text-emerald-700" : "text-zinc-500"}>{STATUS[m.status] ?? m.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
