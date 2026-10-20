"use client";

import { useState } from "react";
import { Check, LoaderCircle, Music } from "lucide-react";
import { api, inputClass, isSignedIn, signInAndReturn } from "./lib/ui";

type MyRequest = { id: string; songTitle: string; artist: string | null; message: string | null; status: string };

const statusText: Record<string, string> = {
  new: "Requested",
  played: "Played ✓",
  skipped: "Not played this time",
};

/** Lets a signed-in listener request up to 3 songs for one show and see what happened to them. */
export default function SongRequestButton({ showId, programmeName }: { showId: string; programmeName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mine, setMine] = useState<MyRequest[]>([]);
  const [max, setMax] = useState(3);
  const [form, setForm] = useState({ songTitle: "", artist: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (!(await isSignedIn())) {
        signInAndReturn();
        return;
      }
      const data = await api<{ max: number; requests: MyRequest[] }>(`/shows/${showId}/song-requests/mine`);
      setMine(data.requests);
      setMax(data.max);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open song requests.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSent("");
    setBusy(true);
    try {
      const created = await api<MyRequest>(`/shows/${showId}/song-requests`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setMine((all) => [...all, created]);
      setSent(`Sent “${created.songTitle}” to the RJ.`);
      setForm({ songTitle: "", artist: "", message: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your request.");
    } finally {
      setBusy(false);
    }
  }

  const left = max - mine.length;

  return (
    <>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
        disabled={loading}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {loading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Music size={16} aria-hidden="true" />}
        Request a song
      </button>

      {error && !open ? <p className="w-full text-sm text-red-700" role="alert">{error}</p> : null}

      {open ? (
        <div className="w-full rounded-xl bg-zinc-50 p-3">
          {mine.length ? (
            <ul className="mb-3 space-y-1 text-sm">
              {mine.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span className="text-zinc-900">
                    {r.songTitle}
                    {r.artist ? <span className="text-zinc-500"> · {r.artist}</span> : null}
                  </span>
                  <span className={r.status === "played" ? "font-semibold text-emerald-700" : "text-zinc-600"}>{statusText[r.status] ?? r.status}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {left > 0 ? (
            <form onSubmit={submit} className="space-y-2">
              <div>
                <label htmlFor={`song-${showId}`} className="mb-1 block text-xs font-medium text-zinc-700">Song *</label>
                <input id={`song-${showId}`} required maxLength={150} value={form.songTitle} onChange={(e) => setForm((f) => ({ ...f, songTitle: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label htmlFor={`artist-${showId}`} className="mb-1 block text-xs font-medium text-zinc-700">Artist or film</label>
                <input id={`artist-${showId}`} maxLength={150} value={form.artist} onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label htmlFor={`msg-${showId}`} className="mb-1 block text-xs font-medium text-zinc-700">Dedication or message</label>
                <input id={`msg-${showId}`} maxLength={280} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="For my sister on her birthday…" className={inputClass} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
                  {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                  Send to {programmeName}
                </button>
                <span className="text-xs text-zinc-500">{left} of {max} requests left for this show</span>
              </div>
            </form>
          ) : (
            <p className="text-sm text-zinc-600">You&apos;ve used all {max} requests for this show.</p>
          )}
          {sent ? <p className="mt-2 text-sm text-emerald-700" role="status">{sent}</p> : null}
          {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </>
  );
}
