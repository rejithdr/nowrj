"use client";

import { useState } from "react";
import { LoaderCircle, Plus, Vote, X } from "lucide-react";
import { api, inputClass } from "./ui";
import { percent, type Poll } from "./poll-types";

/**
 * In the RJ and station message queue: the show's polls with live results,
 * a Close button for the open one, and a form to start a new poll.
 */
export default function PollManager({
  showId,
  polls,
  ended,
  readOnly,
  onChange,
}: {
  showId: string;
  polls: Poll[];
  ended: boolean;
  readOnly: boolean;
  onChange: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = polls.find((p) => p.open);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/polls/show/${showId}`, { method: "POST", body: JSON.stringify({ question, options: options.filter((o) => o.trim()) }) });
      setCreating(false);
      setQuestion("");
      setOptions(["", ""]);
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the poll.");
    } finally {
      setBusy(false);
    }
  }

  async function close(pollId: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/polls/${pollId}/close`, { method: "PATCH" });
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not close the poll.");
    } finally {
      setBusy(false);
    }
  }

  if (!polls.length && (readOnly || ended)) return null;

  return (
    <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
      {polls.map((poll) => (
        <div key={poll.id} className="mb-3 last:mb-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Vote size={14} className="text-violet-700" aria-hidden="true" />
            <strong className="text-zinc-900">{poll.question}</strong>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${poll.open ? "bg-violet-200 text-violet-900" : "bg-zinc-200 text-zinc-700"}`}>
              {poll.open ? "Open" : "Closed"}
            </span>
            <span className="text-xs text-zinc-500">{poll.total} {poll.total === 1 ? "vote" : "votes"}</span>
            {poll.open && !readOnly ? (
              <button type="button" disabled={busy} onClick={() => void close(poll.id)} className="text-xs font-semibold text-zinc-700 underline">
                Close poll
              </button>
            ) : null}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-zinc-700">
            {poll.options.map((o) => (
              <li key={o.id} className="flex justify-between gap-2">
                <span>{o.label}</span>
                <span className="tabular-nums">{o.votes} · {percent(o.votes, poll.total)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {!readOnly && !ended && !open ? (
        creating ? (
          <form onSubmit={start} className="mt-2 space-y-2">
            <label htmlFor={`pq-${showId}`} className="block text-xs font-medium text-zinc-700">Poll question</label>
            <input id={`pq-${showId}`} required maxLength={120} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Which song should I play next?" className={inputClass} />
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label={`Option ${i + 1}`}
                  required={i < 2}
                  maxLength={60}
                  value={o}
                  onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Option ${i + 1}`}
                  className={inputClass}
                />
                {i >= 2 ? (
                  <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => setOptions(options.filter((_, j) => j !== i))} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100">
                    <X size={16} />
                  </button>
                ) : null}
              </div>
            ))}
            {options.length < 5 ? (
              <button type="button" onClick={() => setOptions([...options, ""])} className="inline-flex items-center gap-1 text-sm font-semibold text-violet-800 hover:underline">
                <Plus size={14} aria-hidden="true" /> Add an option
              </button>
            ) : null}
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60">
                {busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null} Start poll
              </button>
              <button type="button" onClick={() => setCreating(false)} className="min-h-9 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-800 hover:underline">
            <Vote size={14} aria-hidden="true" /> Start a poll
          </button>
        )
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
