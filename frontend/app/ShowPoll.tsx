"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Vote } from "lucide-react";
import { api } from "./lib/ui";
import { percent, type Poll } from "./lib/poll-types";

/**
 * The poll on a show card. Anyone can vote once, signed in or not (counted
 * once per phone). After voting, or once the poll closes, it shows results.
 */
export default function ShowPoll({ poll: initial }: { poll: Poll }) {
  const [poll, setPoll] = useState(initial);
  const [mine, setMine] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Record<string, string>>(`/polls/mine?ids=${initial.id}`)
      .then((r) => setMine(r[initial.id] ?? null))
      .catch(() => undefined);
  }, [initial.id]);

  async function vote(optionId: string) {
    setBusy(optionId);
    setError("");
    try {
      const result = await api<Poll & { myOptionId: string | null }>(`/polls/${poll.id}/vote`, {
        method: "POST",
        body: JSON.stringify({ optionId }),
      });
      setPoll(result);
      setMine(result.myOptionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your vote.");
    } finally {
      setBusy(null);
    }
  }

  const showResults = Boolean(mine) || !poll.open;

  return (
    <section aria-label="Poll" className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-800">
        <Vote size={14} aria-hidden="true" /> Poll{poll.open ? "" : " · closed"}
      </p>
      <p className="mt-1 font-semibold text-zinc-900">{poll.question}</p>
      {showResults ? (
        <ul className="mt-2 space-y-1.5">
          {poll.options.map((o) => {
            const p = percent(o.votes, poll.total);
            const chosen = o.id === mine;
            return (
              <li key={o.id} className="relative overflow-hidden rounded-lg bg-white">
                <div className={`absolute inset-y-0 left-0 ${chosen ? "bg-violet-200" : "bg-violet-100"}`} style={{ width: `${p}%` }} aria-hidden="true" />
                <div className="relative flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className={`flex items-center gap-1.5 ${chosen ? "font-semibold text-violet-900" : "text-zinc-800"}`}>
                    {chosen ? <Check size={14} aria-label="Your vote" /> : null}
                    {o.label}
                  </span>
                  <span className="tabular-nums font-semibold text-zinc-700">{p}%</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {poll.options.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={busy !== null}
              onClick={() => void vote(o.id)}
              className="inline-flex min-h-11 items-center justify-between rounded-lg border border-violet-200 bg-white px-3 text-left text-sm font-semibold text-zinc-800 hover:border-violet-400 disabled:opacity-60"
            >
              {o.label}
              {busy === o.id ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-zinc-500">
        {poll.total} {poll.total === 1 ? "vote" : "votes"}
        {mine && poll.open ? " · Thanks for voting" : ""}
      </p>
      {error ? <p className="mt-1 text-sm text-red-700" role="alert">{error}</p> : null}
    </section>
  );
}
