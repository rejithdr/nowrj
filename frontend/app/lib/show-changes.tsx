"use client";

import { useCallback, useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { api, inputClass, Notice, primaryButton, quietButton } from "./ui";

type UpcomingShow = {
  originalStartsAt: string;
  originalEndsAt: string;
  airDate: string;
  status: "scheduled" | "cancelled" | "moved";
  startsAt: string;
  endsAt: string;
  reason: string | null;
  started: boolean;
};

const TZ = "Asia/Kolkata";
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

/** The next 7 days of one programme's shows, each of which can be cancelled, moved or restored. */
export default function UpcomingShows({ programmeId }: { programmeId: string }) {
  const [open, setOpen] = useState(false);
  const [shows, setShows] = useState<UpcomingShow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [times, setTimes] = useState({ startTime: "", endTime: "" });

  const load = useCallback(async () => {
    try {
      setShows(await api<UpcomingShow[]>(`/shows/changes/${programmeId}`));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the shows.");
    }
  }, [programmeId]);

  async function act(show: UpcomingShow, action: "cancel" | "move" | "restore", extra: Record<string, string | null> = {}) {
    setBusy(show.originalStartsAt);
    setError("");
    try {
      await api(`/shows/changes/${programmeId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ originalStartsAt: show.originalStartsAt, ...extra }),
      });
      setMoving(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  function cancel(show: UpcomingShow) {
    const reason = window.prompt(`Cancel the show on ${day(show.originalStartsAt)}? Listeners won't see it.\n\nReason (optional):`);
    if (reason === null) return;
    void act(show, "cancel", { reason });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => { setOpen(true); void load(); }} className="mt-2 ml-4 text-sm font-semibold text-orange-700 hover:underline">
        Cancel or move a show
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl bg-zinc-50 p-3">
      <p className="text-sm font-semibold text-zinc-800">Next 7 days</p>
      <p className="text-xs text-zinc-500">Changes affect one day only; the weekly schedule stays the same.</p>
      {error ? <Notice kind="error" text={error} /> : null}
      {!shows ? (
        <p className="mt-2 text-sm text-zinc-500">Loading…</p>
      ) : shows.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">No shows in the next 7 days.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {shows.map((show) => {
            const id = show.originalStartsAt;
            return (
              <li key={id} className="rounded-lg bg-white px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={show.status === "cancelled" ? "text-zinc-400 line-through" : "text-zinc-900"}>
                    {day(show.originalStartsAt)} · {clock(show.originalStartsAt)}–{clock(show.originalEndsAt)}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {show.status === "cancelled" ? <span className="font-semibold text-red-700">Cancelled</span> : null}
                    {show.status === "moved" ? (
                      <span className="font-semibold text-amber-800">Moved to {clock(show.startsAt)}–{clock(show.endsAt)}</span>
                    ) : null}
                    {show.started ? (
                      <span className="text-xs text-zinc-500">Started</span>
                    ) : show.status === "scheduled" ? (
                      <>
                        <button type="button" disabled={busy === id} onClick={() => { setMoving(id); setTimes({ startTime: "", endTime: "" }); }} className="text-sm font-semibold text-orange-700 hover:underline">
                          Change time
                        </button>
                        <button type="button" disabled={busy === id} onClick={() => cancel(show)} className="text-sm font-semibold text-red-700 hover:underline">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" disabled={busy === id} onClick={() => void act(show, "restore")} className="text-sm font-semibold text-zinc-700 hover:underline">
                        Undo
                      </button>
                    )}
                  </span>
                </div>
                {show.reason ? <p className="mt-0.5 text-xs text-zinc-500">“{show.reason}”</p> : null}
                {moving === id ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); void act(show, "move", times); }}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <div>
                      <label htmlFor={`ms-${id}`} className="mb-1 block text-xs text-zinc-600">New start</label>
                      <input id={`ms-${id}`} type="time" required value={times.startTime} onChange={(e) => setTimes((t) => ({ ...t, startTime: e.target.value }))} className={`${inputClass} w-32`} />
                    </div>
                    <div>
                      <label htmlFor={`me-${id}`} className="mb-1 block text-xs text-zinc-600">New end</label>
                      <input id={`me-${id}`} type="time" required value={times.endTime} onChange={(e) => setTimes((t) => ({ ...t, endTime: e.target.value }))} className={`${inputClass} w-32`} />
                    </div>
                    <button type="submit" disabled={busy === id} className={primaryButton}>
                      {busy === id ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                      Move
                    </button>
                    <button type="button" onClick={() => setMoving(null)} className={quietButton} aria-label="Cancel change"><X size={14} aria-hidden="true" /></button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" onClick={() => setOpen(false)} className={`${quietButton} mt-3`}>Done</button>
    </div>
  );
}
