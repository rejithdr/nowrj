"use client";

import { useEffect, useState } from "react";
import { api } from "./ui";

type ServerError = { at: string; method: string; path: string; status: number; message: string; where: string | null };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", second: "2-digit" });

/** Super Admin: server errors since the backend last restarted, and the health check's view. */
export default function ServerErrors() {
  const [errors, setErrors] = useState<{ sinceStart: number; recent: ServerError[] } | null>(null);
  const [health, setHealth] = useState<{ status: string; problems: string[]; lastBackup: string | null } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setErrors(await api("/admin/errors"));
      } catch {
        setErrors({ sinceStart: 0, recent: [] });
      }
      try {
        setHealth(await api("/health"));
      } catch (err) {
        // A 503 still carries the problems in its body, but api() turns it into an error.
        setHealth({ status: "problem", problems: [err instanceof Error ? err.message : "Health check failed"], lastBackup: null });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="text-sm">
      {health ? (
        <p className={health.status === "ok" ? "font-semibold text-emerald-800" : "font-semibold text-red-700"}>
          {health.status === "ok" ? "Health check: all good." : `Health check: ${health.problems.join("; ")}`}
          {health.lastBackup ? <span className="block text-xs font-normal text-zinc-500">Last good backup {when(health.lastBackup)}</span> : null}
        </p>
      ) : null}
      {errors ? (
        <>
          <p className="mt-3 text-zinc-700">
            {errors.sinceStart === 0 ? "No server errors since the backend last started." : `${errors.sinceStart} server error${errors.sinceStart === 1 ? "" : "s"} since the backend last started. Newest first:`}
          </p>
          <ul className="mt-2 divide-y divide-zinc-100">
            {errors.recent.slice(0, 30).map((e, i) => (
              <li key={`${e.at}-${i}`} className="py-2">
                <p className="font-mono text-xs text-zinc-500">{when(e.at)} · {e.method} {e.path} · {e.status}</p>
                <p className="break-words text-zinc-900">{e.message}</p>
                {e.where ? <p className="break-all font-mono text-xs text-zinc-500">{e.where}</p> : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500">Full details: pm2 logs nowrj-backend on the server.</p>
        </>
      ) : null}
    </div>
  );
}
