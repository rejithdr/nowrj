"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, LoaderCircle, MessageCircleQuestion, Plus, RotateCcw, X } from "lucide-react";
import { API, api, inputClass, labelClass, Notice, primaryButton, quietButton } from "./ui";
import { squareJpeg } from "./rj-profile";

type Question = { id: string; message: string; status: string; listenerName: string; createdAt: string };
type Session = {
  id: string;
  guestName: string;
  guestLine: string | null;
  photoUrl: string | null;
  recordingAt: string;
  airAt: string | null;
  opensAt: string;
  closesAt: string;
  status: string;
  programme: { id: string; name: string };
  questions: Question[];
};

const TZ = "Asia/Kolkata";
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
/** A datetime-local value is India time. */
const toIso = (local: string) => (local ? new Date(`${local}:00+05:30`).toISOString() : null);

function windowText(s: Session, now: Date) {
  if (s.status === "cancelled") return "Cancelled";
  if (now < new Date(s.opensAt)) return `Questions open ${when(s.opensAt)}`;
  if (now < new Date(s.closesAt)) return `Taking questions until ${when(s.closesAt)}`;
  return "Questions closed";
}

/**
 * Ask the guest, for the RJ and station dashboards: set up a guest recording,
 * then see the questions and mark them used in the recording or skipped.
 * `path` is /guest-sessions/rj or /guest-sessions/station/<id>.
 */
export default function GuestSessions({ path, programmes }: { path: string; programmes: { id: string; name: string }[] }) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ programmeId: "", guestName: "", guestLine: "", recordingAt: "", airAt: "" });
  const photoFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setSessions(await api<Session[]>(path));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load guest sessions.");
    }
  }, [path]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError("");
    try {
      await api("/guest-sessions", {
        method: "POST",
        body: JSON.stringify({
          programmeId: form.programmeId || programmes[0]?.id,
          guestName: form.guestName,
          guestLine: form.guestLine || null,
          recordingAt: toIso(form.recordingAt),
          airAt: toIso(form.airAt),
        }),
      });
      setForm({ programmeId: "", guestName: "", guestLine: "", recordingAt: "", airAt: "" });
      setAdding(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  async function act(key: string, call: () => Promise<unknown>) {
    setBusy(key);
    setError("");
    try {
      await call();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadPhoto(file: File | undefined) {
    const id = photoFor.current;
    if (!file || !id) return;
    await act(`photo-${id}`, async () => {
      const body = new FormData();
      body.append("photo", await squareJpeg(file), "guest.jpg");
      const response = await fetch(`${API}/guest-sessions/${id}/photo`, { method: "POST", body, credentials: "include" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Could not upload the photo.");
    });
    if (fileInput.current) fileInput.current.value = "";
  }

  const now = new Date();
  return (
    <div className="mt-3">
      <p className="text-sm text-zinc-600">
        For a show recorded with a guest. Listeners can send questions from 24 hours until 2 hours before the recording, in the
        &ldquo;Ask the guest&rdquo; section of NowRJ.
      </p>
      {error ? <div className="mt-3"><Notice kind="error" text={error} /></div> : null}
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => void uploadPhoto(e.target.files?.[0])} />

      {adding ? (
        <form onSubmit={create} className="mt-4 grid gap-3 rounded-xl bg-zinc-50 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="g-programme" className={labelClass}>Programme</label>
            <select id="g-programme" value={form.programmeId || programmes[0]?.id || ""} onChange={(e) => setForm({ ...form, programmeId: e.target.value })} className={inputClass}>
              {programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="g-name" className={labelClass}>Guest&apos;s name *</label>
            <input id="g-name" required maxLength={100} value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="g-line" className={labelClass}>About the guest</label>
            <input id="g-line" maxLength={100} placeholder="Actor, Cardiologist…" value={form.guestLine} onChange={(e) => setForm({ ...form, guestLine: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="g-rec" className={labelClass}>Recording date and time *</label>
            <input id="g-rec" type="datetime-local" required value={form.recordingAt} onChange={(e) => setForm({ ...form, recordingAt: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="g-air" className={labelClass}>Airs on (if known)</label>
            <input id="g-air" type="datetime-local" value={form.airAt} onChange={(e) => setForm({ ...form, airAt: e.target.value })} className={inputClass} />
          </div>
          <p className="text-xs text-zinc-500 sm:col-span-2">Times are India time. You can add the guest&apos;s photo after saving.</p>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy === "create"} className={primaryButton}>
              {busy === "create" ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              Save guest session
            </button>
            <button type="button" onClick={() => setAdding(false)} className={quietButton}>Cancel</button>
          </div>
        </form>
      ) : programmes.length ? (
        <button type="button" onClick={() => setAdding(true)} className={`${quietButton} mt-4`}>
          <Plus size={14} aria-hidden="true" /> Add a guest recording
        </button>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">Add a programme first.</p>
      )}

      {sessions === null && !error ? <p className="mt-4 text-sm text-zinc-500">Loading…</p> : null}
      {sessions?.length === 0 ? <p className="mt-4 text-sm text-zinc-500">No guest recordings yet.</p> : null}

      <div className="mt-4 space-y-4">
        {(sessions ?? []).map((s) => {
          const closed = now >= new Date(s.closesAt);
          const waiting = s.questions.filter((q) => q.status === "new");
          const handled = s.questions.filter((q) => q.status !== "new");
          return (
            <section key={s.id} className={`rounded-xl border p-4 ${s.status === "cancelled" ? "border-zinc-200 opacity-60" : "border-violet-200"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {s.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-700" aria-hidden="true">
                      <MessageCircleQuestion size={22} />
                    </span>
                  )}
                  <div>
                    <p className="font-semibold text-zinc-900">
                      {s.guestName}
                      {s.guestLine ? <span className="font-normal text-zinc-600"> · {s.guestLine}</span> : null}
                    </p>
                    <p className="text-sm text-zinc-600">
                      {s.programme.name} · recording {when(s.recordingAt)}
                      {s.airAt ? ` · airs ${when(s.airAt)}` : ""}
                    </p>
                    <p className="text-xs font-semibold text-violet-700">{windowText(s, now)} · {s.questions.length} question{s.questions.length === 1 ? "" : "s"}</p>
                  </div>
                </div>
                {s.status !== "cancelled" ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={quietButton} disabled={busy !== null} onClick={() => { photoFor.current = s.id; fileInput.current?.click(); }}>
                      {busy === `photo-${s.id}` ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Camera size={14} aria-hidden="true" />}
                      {s.photoUrl ? "Change photo" : "Add photo"}
                    </button>
                    {!closed ? (
                      <button
                        type="button"
                        className={quietButton}
                        disabled={busy !== null}
                        onClick={() => {
                          if (window.confirm(`Cancel the guest session with ${s.guestName}? Listeners will no longer see it.`)) {
                            void act(`cancel-${s.id}`, () => api(`/guest-sessions/${s.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }));
                          }
                        }}
                      >
                        <X size={14} aria-hidden="true" /> Cancel session
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {s.questions.length ? (
                <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                  {[...waiting, ...handled].map((q) => (
                    <li key={q.id} className={`flex flex-wrap items-start justify-between gap-2 p-3 ${q.status === "new" ? "" : "bg-zinc-50"}`}>
                      <div className="min-w-0">
                        <p className={`font-medium ${q.status === "new" ? "text-zinc-900" : "text-zinc-500 line-through decoration-zinc-300"}`}>&ldquo;{q.message}&rdquo;</p>
                        <p className="text-sm text-zinc-600">from {q.listenerName}</p>
                      </div>
                      {q.status === "new" ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy !== null || !closed}
                            title={closed ? undefined : "Available once questions close, 2 hours before the recording"}
                            onClick={() => void act(q.id, () => api(`/guest-sessions/questions/${q.id}`, { method: "PATCH", body: JSON.stringify({ status: "played" }) }))}
                            className="min-h-9 rounded-full bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Used in recording
                          </button>
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void act(q.id, () => api(`/guest-sessions/questions/${q.id}`, { method: "PATCH", body: JSON.stringify({ status: "skipped" }) }))}
                            className="min-h-9 rounded-full border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                          >
                            Skip
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void act(q.id, () => api(`/guest-sessions/questions/${q.id}`, { method: "PATCH", body: JSON.stringify({ status: "new" }) }))}
                          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
                        >
                          <RotateCcw size={13} aria-hidden="true" />
                          {q.status === "played" ? "Used" : "Skipped"} · Undo
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : s.status !== "cancelled" ? (
                <p className="mt-3 text-sm text-zinc-500">No questions yet.</p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
