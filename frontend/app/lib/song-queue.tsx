"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Notice } from "./ui";
import { wording, type InteractionType } from "./interaction";

type QueueRequest = {
  id: string;
  kind?: InteractionType;
  songTitle: string | null;
  artist: string | null;
  message: string | null;
  status: string;
  listenerName: string;
  createdAt: string;
};
type QueueShow = {
  showId: string;
  programmeName: string;
  interactionType?: InteractionType;
  startsAt: string;
  endsAt: string;
  live: boolean;
  requests: QueueRequest[];
};

const clock = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Song requests and questions for live and upcoming shows; refreshes every 30
 * seconds. The RJ dashboard uses the RJ's queue; the station dashboard passes
 * the station's queue as `path`.
 */
export default function SongQueue({ path = "/shows/song-requests/rj" }: { path?: string }) {
  const [shows, setShows] = useState<QueueShow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setShows(await api<QueueShow[]>(path));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load requests and questions.");
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
      setError(err instanceof Error ? err.message : "Could not update the request.");
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
            {show.requests.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-500">No {words.items} yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {[...waiting, ...handled].map((r) => {
                  const isQuestion = (r.kind ?? "song") === "question";
                  const itemWords = wording[isQuestion ? "question" : "song"];
                  return (
                  <li key={r.id} className={`flex flex-wrap items-start justify-between gap-2 p-3 ${r.status === "new" ? "" : "bg-zinc-50"}`}>
                    <div className="min-w-0">
                      <p className={`font-semibold ${r.status === "new" ? "text-zinc-900" : "text-zinc-500 line-through decoration-zinc-300"}`}>
                        {isQuestion ? `“${r.message}”` : r.songTitle}
                        {!isQuestion && r.artist ? <span className="font-normal text-zinc-500"> · {r.artist}</span> : null}
                      </p>
                      <p className="text-sm text-zinc-600">
                        from {r.listenerName}
                        {!isQuestion && r.message ? <> · “{r.message}”</> : null}
                      </p>
                    </div>
                    {r.status === "new" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy === r.id || new Date(show.startsAt) > new Date()}
                          title={new Date(show.startsAt) > new Date() ? "Opens when the show starts" : undefined}
                          onClick={() => void mark(r.id, "played")}
                          className="min-h-9 rounded-full bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {itemWords.doneLong}
                        </button>
                        <button type="button" disabled={busy === r.id} onClick={() => void mark(r.id, "skipped")} className="min-h-9 rounded-full border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60">
                          Skip
                        </button>
                      </div>
                    ) : (
                      <button type="button" disabled={busy === r.id} onClick={() => void mark(r.id, "new")} className="text-sm font-semibold text-zinc-600 hover:underline">
                        {r.status === "played" ? itemWords.doneLong : "Skipped"} · Undo
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
