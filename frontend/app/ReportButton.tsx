"use client";

import { useState } from "react";
import { Flag, LoaderCircle } from "lucide-react";
import { api } from "./lib/ui";

const REASONS = [
  { value: "wrong_info", label: "Wrong information" },
  { value: "offensive", label: "Offensive or hateful" },
  { value: "spam", label: "Spam or misleading" },
  { value: "unsafe", label: "Unsafe or harmful advice" },
  { value: "other", label: "Something else" },
] as const;

/**
 * A small "Report" link for a programme, RJ or ad. Anyone can report, signed
 * in or not; reports go to the NowRJ team, who can hide what was reported.
 */
export default function ReportButton({
  targetType,
  targetId,
  showId,
  label = "Report",
  alignEnd = false,
}: {
  targetType: "programme" | "rj" | "ad";
  targetId: string;
  showId?: string;
  label?: string;
  /** In a row of buttons: push the link to the right end. */
  alignEnd?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) {
      setError("Choose a reason.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api<{ alreadyReported: boolean }>("/reports", {
        method: "POST",
        body: JSON.stringify({ targetType, targetId, showId, reason, details }),
      });
      setDone(r.alreadyReported ? "You've already reported this. The NowRJ team will look at it." : "Thanks. The NowRJ team will look at it.");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the report.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="w-full text-xs text-zinc-600" role="status">{done}</p>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`${alignEnd ? "ml-auto " : ""}inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800`}
      >
        <Flag size={12} aria-hidden="true" /> {label}
      </button>
      {open ? (
        <form onSubmit={send} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <fieldset>
            <legend className="font-semibold text-zinc-900">What&apos;s wrong?</legend>
            <div className="mt-2 space-y-1">
              {REASONS.map((r) => (
                <label key={r.value} className="flex min-h-8 cursor-pointer items-center gap-2 text-zinc-800">
                  <input type="radio" name={`reason-${targetId}`} value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor={`rd-${targetId}`} className="mt-2 block text-xs font-medium text-zinc-700">More details (optional)</label>
          <textarea
            id={`rd-${targetId}`}
            maxLength={300}
            rows={2}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-2 flex items-center gap-2">
            <button type="submit" disabled={busy} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-zinc-900 px-4 font-semibold text-white disabled:opacity-60">
              {busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null} Send report
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-9 rounded-full px-3 font-semibold text-zinc-700">Cancel</button>
          </div>
          {error ? <p className="mt-2 text-red-700" role="alert">{error}</p> : null}
        </form>
      ) : null}
    </>
  );
}
