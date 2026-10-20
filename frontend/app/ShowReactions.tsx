"use client";
import { API_URL } from "./lib/config";

import { createContext, useContext, useEffect, useState } from "react";
import { Flame, Heart } from "lucide-react";

const API = API_URL;

type Status = Record<string, { liked: boolean; fired: boolean }>;
type Ctx = { signedIn: boolean | null; status: Status };

const ReactionContext = createContext<Ctx>({ signedIn: null, status: {} });

/** Loads the signed-in listener's reactions for every show on the page in one request. */
export function ShowReactionsProvider({ showIds, children }: { showIds: string[]; children: React.ReactNode }) {
  const [ctx, setCtx] = useState<Ctx>({ signedIn: null, status: {} });
  const idList = showIds.join(",");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const me = await fetch(`${API}/auth/me`, { credentials: "include", cache: "no-store" });
        if (!me.ok) {
          if (!cancelled) setCtx({ signedIn: false, status: {} });
          return;
        }
        let status: Status = {};
        if (idList) {
          const res = await fetch(`${API}/shows/reactions/status?ids=${idList}`, { credentials: "include", cache: "no-store" });
          if (res.ok) status = await res.json();
        }
        if (!cancelled) setCtx({ signedIn: true, status });
      } catch {
        if (!cancelled) setCtx({ signedIn: false, status: {} });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [idList]);

  return <ReactionContext.Provider value={ctx}>{children}</ReactionContext.Provider>;
}

type Props = {
  showId: string;
  likes: number;
  fires: number;
  canReact: boolean;
  notYetMessage: string;
};

/** Like and Fire for one show. Signed-out listeners are sent to sign in and brought back. */
export default function ShowReactions({ showId, likes, fires, canReact, notYetMessage }: Props) {
  const { signedIn, status } = useContext(ReactionContext);
  const [state, setState] = useState({ likes, fires, liked: false, fired: false });
  const [busy, setBusy] = useState<"like" | "fire" | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const mine = status[showId];
    if (mine) setState((s) => ({ ...s, liked: mine.liked, fired: mine.fired }));
  }, [status, showId]);

  async function toggle(type: "like" | "fire") {
    setMessage("");
    if (!canReact) {
      setMessage(notYetMessage);
      return;
    }
    if (signedIn === false) {
      sessionStorage.setItem("nowrjReturnTo", window.location.pathname);
      window.location.href = `${API}/auth/google?returnTo=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const on = type === "like" ? state.liked : state.fired;
    setBusy(type);
    try {
      const res = await fetch(`${API}/shows/${showId}/reactions?type=${type}`, {
        method: on ? "DELETE" : "POST",
        credentials: "include",
      });
      if (res.status === 401) {
        sessionStorage.setItem("nowrjReturnTo", window.location.pathname);
        window.location.href = `${API}/auth/google`;
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(data?.message ?? "Could not save. Please try again.");
        return;
      }
      setState((s) => ({
        likes: data.likes,
        fires: data.fires,
        liked: type === "like" ? data.active : s.liked,
        fired: type === "fire" ? data.active : s.fired,
      }));
    } catch {
      setMessage("Could not connect to NowRJ. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const base =
    "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60";
  const off = "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50";

  return (
    <>
      <button
        type="button"
        onClick={() => void toggle("like")}
        disabled={busy !== null || signedIn === null}
        aria-pressed={state.liked}
        aria-label={`Like this show, ${state.likes} likes`}
        className={`${base} ${state.liked ? "border-rose-300 bg-rose-50 text-rose-700" : off} ${canReact ? "" : "opacity-60"}`}
      >
        <Heart size={16} aria-hidden="true" fill={state.liked ? "currentColor" : "none"} />
        {busy === "like" ? "Saving…" : state.liked ? "Liked" : "Like"}
        <span className="tabular-nums text-zinc-500">{state.likes}</span>
      </button>
      <button
        type="button"
        onClick={() => void toggle("fire")}
        disabled={busy !== null || signedIn === null}
        aria-pressed={state.fired}
        aria-label={`Fire for this show, ${state.fires} fires`}
        className={`${base} ${state.fired ? "border-orange-300 bg-orange-50 text-orange-700" : off} ${canReact ? "" : "opacity-60"}`}
      >
        <Flame size={16} aria-hidden="true" fill={state.fired ? "currentColor" : "none"} />
        {busy === "fire" ? "Saving…" : "Fire"}
        <span className="tabular-nums text-zinc-500">{state.fires}</span>
      </button>
      {message ? (
        <p className="w-full text-sm text-zinc-600" role="status">
          {message}
        </p>
      ) : null}
    </>
  );
}
