"use client";

import { useState } from "react";
import { Check, Info, LoaderCircle, MessageCircleQuestion, Music } from "lucide-react";
import { api, inputClass, isSignedIn, signInAndReturn } from "./lib/ui";
import { DEFAULT_QUESTION_NOTICE, hasContactDetails, wording, type InteractionType } from "./lib/interaction";

type MyRequest = {
  id: string;
  kind?: InteractionType;
  songTitle: string | null;
  artist: string | null;
  message: string | null;
  status: string;
};

const statusText: Record<InteractionType, Record<string, string>> = {
  song: { new: "Requested", played: "Played ✓", skipped: "Not played this time" },
  question: { new: "Asked", played: "Answered on air ✓", skipped: "Not answered this time" },
};

/**
 * Lets a signed-in listener request up to 3 songs for one show, or ask up to
 * 3 questions when the programme is in "Ask a question" mode, and see what
 * happened to them.
 */
export default function SongRequestButton({
  showId,
  programmeName,
  mode = "song",
  notice = null,
}: {
  showId: string;
  programmeName: string;
  mode?: InteractionType;
  notice?: string | null;
}) {
  const words = wording[mode];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mine, setMine] = useState<MyRequest[]>([]);
  const [max, setMax] = useState(3);
  const [form, setForm] = useState({ songTitle: "", artist: "", message: "", question: "" });
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
      setError(err instanceof Error ? err.message : `Could not open ${words.items}.`);
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSent("");
    const text = mode === "question" ? [form.question] : [form.songTitle, form.artist, form.message];
    if (text.some(hasContactDetails)) {
      setError("Please remove phone numbers, email addresses and links.");
      return;
    }
    setBusy(true);
    try {
      const body = mode === "question" ? { question: form.question } : { songTitle: form.songTitle, artist: form.artist, message: form.message };
      const created = await api<MyRequest>(`/shows/${showId}/song-requests`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMine((all) => [...all, created]);
      setSent(mode === "question" ? "Your question has been sent." : `Sent “${created.songTitle}” to the RJ.`);
      setForm({ songTitle: "", artist: "", message: "", question: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not send your ${words.item}.`);
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
        {loading ? (
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
        ) : mode === "question" ? (
          <MessageCircleQuestion size={16} aria-hidden="true" />
        ) : (
          <Music size={16} aria-hidden="true" />
        )}
        {words.button}
      </button>

      {error && !open ? <p className="w-full text-sm text-red-700" role="alert">{error}</p> : null}

      {open ? (
        <div className="w-full rounded-xl bg-zinc-50 p-3">
          {mine.length ? (
            <ul className="mb-3 space-y-1 text-sm">
              {mine.map((r) => {
                const kind = r.kind ?? "song";
                return (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="min-w-0 text-zinc-900">
                      {kind === "question" ? `“${r.message}”` : r.songTitle}
                      {kind === "song" && r.artist ? <span className="text-zinc-500"> · {r.artist}</span> : null}
                    </span>
                    <span className={`shrink-0 ${r.status === "played" ? "font-semibold text-emerald-700" : "text-zinc-600"}`}>
                      {statusText[kind][r.status] ?? r.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {left > 0 ? (
            <form onSubmit={submit} className="space-y-2">
              {mode === "question" ? (
                <>
                  <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-900">
                    <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{notice?.trim() || DEFAULT_QUESTION_NOTICE}</span>
                  </p>
                  <div>
                    <label htmlFor={`q-${showId}`} className="mb-1 block text-xs font-medium text-zinc-700">Your question *</label>
                    <textarea
                      id={`q-${showId}`}
                      required
                      maxLength={200}
                      rows={3}
                      value={form.question}
                      onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                      className={`${inputClass} py-2`}
                    />
                    <p className="mt-1 text-right text-xs text-zinc-500">{form.question.length}/200 · no phone numbers or links</p>
                  </div>
                </>
              ) : (
              <>
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
                <input id={`msg-${showId}`} maxLength={200} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="For my sister on her birthday…" className={inputClass} />
              </div>
              </>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
                  {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                  Send to {programmeName}
                </button>
                <span className="text-xs text-zinc-500">{left} of {max} {words.items} left for this show</span>
              </div>
            </form>
          ) : (
            <p className="text-sm text-zinc-600">You&apos;ve used all {max} {words.items} for this show.</p>
          )}
          {sent ? <p className="mt-2 text-sm text-emerald-700" role="status">{sent}</p> : null}
          {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </>
  );
}
