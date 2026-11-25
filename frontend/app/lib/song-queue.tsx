"use client";

import { useCallback, useEffect, useState } from "react";
import { Flame, Heart, MessageCircle, MessageCircleQuestion, Music, Phone, ThumbsUp } from "lucide-react";
import { api, Notice } from "./ui";
import { wording, type InteractionType, type MessageKind } from "./interaction";
import PollManager from "./poll-manager";
import type { Poll } from "./poll-types";

type QueueRequest = {
  id: string;
  kind?: MessageKind;
  songTitle: string | null;
  artist: string | null;
  message: string | null;
  dedicatedTo?: string | null;
  status: string;
  listenerName: string;
  /** null: sent before listeners were asked. */
  okOnAir?: boolean | null;
  /** false the first time it appears in a queue. */
  seen?: boolean;
  createdAt: string;
};
type Counts = { messages: number; readOnAir: number; senders: number; likes: number; fires: number; votes?: number; callTaps: number; total: number };
type QueueShow = {
  showId: string;
  programmeName: string;
  interactionType?: InteractionType;
  startsAt: string;
  endsAt: string;
  live: boolean;
  counts?: Counts;
  polls?: Poll[];
  requests: QueueRequest[];
};

const clock = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });

const KIND: Record<MessageKind, { label: string; Icon: typeof Music; done: string }> = {
  song: { label: "Song", Icon: Music, done: "Played" },
  dedication: { label: "Dedication", Icon: Heart, done: "Read on air" },
  message: { label: "Message", Icon: MessageCircle, done: "Read on air" },
  question: { label: "Question", Icon: MessageCircleQuestion, done: "Answered on air" },
};

/**
 * Song requests, dedications, messages and questions for live and upcoming
 * shows, with each show's interaction count; refreshes every 30 seconds.
 * Opening the queue tells listeners their messages were seen. The RJ
 * dashboard uses the RJ's queue; the station dashboard passes the station's
 * queue as `path`.
 */
/** readOnly: station staff whose designation only lets them view programmes. */
export default function SongQueue({ path = "/shows/song-requests/rj", readOnly = false }: { path?: string; readOnly?: boolean }) {
  const [shows, setShows] = useState<QueueShow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setShows(await api<QueueShow[]>(path));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the message queue.");
    }
  }, [path]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  async function mark(id: string, status: "played" | "skipped" | "new") {
    setBusy(id);
    try {
      await api(`/shows/song-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the message.");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <Notice kind="error" text={error} />;
  if (!shows) return <p className="mt-3 text-sm text-zinc-500">Loading…</p>;
  if (shows.length === 0) {
    return <p className="mt-2 text-sm text-zinc-600">No shows live or coming up in the next 24 hours.</p>;
  }

  return (
    <div className="mt-3 space-y-5">
      {shows.map((show) => {
        const words = wording[show.interactionType ?? "song"];
        const waiting = show.requests.filter((r) => r.status === "new");
        const handled = show.requests.filter((r) => r.status !== "new");
        const c = show.counts;
        return (
          <div key={show.showId}>
            <h3 className="text-sm font-semibold text-zinc-900">
              {show.programmeName} · {clock(show.startsAt)}
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{words.queue}</span>
              {show.live ? <span className="ml-2 text-xs font-bold uppercase text-red-700">Live</span> : null}
              <span className="ml-2 font-normal text-zinc-500">
                {waiting.length} waiting{handled.length ? `, ${handled.length} done` : ""}
              </span>
            </h3>
            {c ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600" aria-label="Interactions for this show">
                <strong className="text-zinc-900">{c.total} interactions</strong>
                <span className="inline-flex items-center gap-1"><MessageCircle size={12} aria-hidden="true" /> {c.messages} {c.messages === 1 ? "message" : "messages"} from {c.senders} {c.senders === 1 ? "listener" : "listeners"}</span>
                <span>{c.readOnAir} read on air</span>
                <span className="inline-flex items-center gap-1"><ThumbsUp size={12} aria-hidden="true" /> {c.likes}</span>
                <span className="inline-flex items-center gap-1"><Flame size={12} aria-hidden="true" /> {c.fires}</span>
                {c.votes !== undefined ? <span>{c.votes} poll {c.votes === 1 ? "vote" : "votes"}</span> : null}
                <span className="inline-flex items-center gap-1"><Phone size={12} aria-hidden="true" /> {c.callTaps} call taps</span>
              </p>
            ) : null}
            {show.polls ? (
              <PollManager
                showId={show.showId}
                polls={show.polls}
                ended={new Date(show.endsAt) <= new Date()}
                readOnly={readOnly}
                onChange={load}
              />
            ) : null}
            {show.requests.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-500">No {words.items} yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {[...waiting, ...handled].map((r) => {
                  const kind = r.kind ?? "song";
                  const k = KIND[kind];
                  const done = r.status !== "new";
                  const title =
                    kind === "song" ? r.songTitle : kind === "dedication" ? `For ${r.dedicatedTo}` : `“${r.message}”`;
                  return (
                    <li key={r.id} className={`flex flex-wrap items-start justify-between gap-2 p-3 ${done ? "bg-zinc-50" : ""}`}>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          <k.Icon size={12} aria-hidden="true" /> {k.label}
                          {r.seen === false ? <span className="rounded-full bg-orange-100 px-1.5 py-0.5 normal-case tracking-normal text-orange-800">New</span> : null}
                          {r.okOnAir === true ? (
                            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 normal-case tracking-normal text-emerald-800">OK to read on air</span>
                          ) : r.okOnAir === false ? (
                            <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 normal-case tracking-normal text-zinc-700">Don&apos;t read on air</span>
                          ) : null}
                        </p>
                        <p className={`mt-0.5 font-semibold ${done ? "text-zinc-500 line-through decoration-zinc-300" : "text-zinc-900"}`}>
                          {title}
                          {kind === "song" && r.artist ? <span className="font-normal text-zinc-500"> · {r.artist}</span> : null}
                        </p>
                        {kind === "dedication" ? (
                          <p className="text-sm text-zinc-800">
                            “{r.message}”
                            {r.songTitle ? <span className="text-zinc-500"> · 🎵 {r.songTitle}{r.artist ? ` (${r.artist})` : ""}</span> : null}
                          </p>
                        ) : null}
                        <p className="text-sm text-zinc-600">
                          from {r.listenerName}
                          {kind === "song" && r.message ? <> · “{r.message}”</> : null}
                        </p>
                      </div>
                      {readOnly ? (
                        done ? <span className="text-sm text-zinc-500">{r.status === "played" ? k.done : "Skipped"}</span> : null
                      ) : !done ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy === r.id || new Date(show.startsAt) > new Date()}
                            title={new Date(show.startsAt) > new Date() ? "Opens when the show starts" : undefined}
                            onClick={() => void mark(r.id, "played")}
                            className="min-h-9 rounded-full bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {k.done}
                          </button>
                          <button type="button" disabled={busy === r.id} onClick={() => void mark(r.id, "skipped")} className="min-h-9 rounded-full border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60">
                            Skip
                          </button>
                        </div>
                      ) : (
                        <button type="button" disabled={busy === r.id} onClick={() => void mark(r.id, "new")} className="text-sm font-semibold text-zinc-600 hover:underline">
                          {r.status === "played" ? k.done : "Skipped"} · Undo
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
