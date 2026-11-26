"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Lock, Send } from "lucide-react";
import { api, isSignedIn, signInAndReturn } from "./ui";
import { hasContactDetails } from "./interaction";
import { HelpLink } from "./help";

type Reply = { id: string; asLabel: string; body: string; createdAt: string };
type Comment = { id: string; body: string; createdAt: string; seen: boolean; replies: Reply[] };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * A private note to a programme's team (its RJs, station and network office).
 * Only the listener and the team see it; the team can reply.
 */
export default function PrivateComment({ programmeId }: { programmeId: string }) {
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Arriving from "My messages" (#messages) opens the conversation straight away.
  useEffect(() => {
    if (window.location.hash !== "#messages") return;
    const timer = window.setTimeout(() => {
      document.getElementById("messages")?.scrollIntoView({ block: "start" });
      void toggle();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle() {
    setError("");
    if (open) {
      setOpen(false);
      return;
    }
    if (!(await isSignedIn())) {
      signInAndReturn();
      return;
    }
    try {
      setMine(await api<Comment[]>(`/programmes/${programmeId}/comments/mine`));
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open your messages.");
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (hasContactDetails(text)) {
      setError("Please remove phone numbers, email addresses and links.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await api<Comment>(`/programmes/${programmeId}/comments`, { method: "POST", body: JSON.stringify({ body: text }) });
      setMine((all) => [created, ...all]);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="messages" className="mt-6 scroll-mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <button type="button" onClick={() => void toggle()} aria-expanded={open} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-orange-50">
        <Lock size={15} aria-hidden="true" /> Private message to the team
      </button>
      <p className="mt-1 text-xs text-zinc-500">Only you and the programme&apos;s RJs, station and office see it. <HelpLink role="listener" guide="private-message" className="min-h-0 px-0 text-xs" /></p>
      {open ? (
        <div className="mt-3">
          <form onSubmit={send} className="space-y-2">
            <label htmlFor={`pc-${programmeId}`} className="sr-only">Your message</label>
            <textarea id={`pc-${programmeId}`} required maxLength={500} rows={3} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" placeholder="Feedback, an idea for the show, a thank-you…" />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-500">{text.length}/500 · no phone numbers or links</span>
              <button type="submit" disabled={busy || !text.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
                {busy ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />} Send
              </button>
            </div>
          </form>
          {mine.length ? (
            <ul className="mt-4 space-y-3">
              {mine.map((c) => (
                <li key={c.id} className="rounded-xl bg-zinc-50 p-3 text-sm">
                  <p className="text-zinc-900">{c.body}</p>
                  <p className="mt-1 text-xs text-zinc-500">{when(c.createdAt)} · {c.seen ? "Seen by the team" : "Sent"}</p>
                  {c.replies.map((r) => (
                    <div key={r.id} className="mt-2 rounded-lg border-l-4 border-orange-300 bg-white p-2">
                      <p className="text-xs font-semibold text-orange-800">{r.asLabel}</p>
                      <p className="text-zinc-900">{r.body}</p>
                      <p className="text-xs text-zinc-500">{when(r.createdAt)}</p>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
