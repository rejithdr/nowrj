"use client";

import { useCallback, useEffect, useState } from "react";
import { Mic } from "lucide-react";
import { api, Notice, primaryButton } from "./ui";

type Shoutout = { id: string; activatedAt: string | null; businessName: string; title: string; offerText: string; startsAt: string; programmeName: string; live: boolean };

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });

/** On the RJ dashboard: approved shout-outs for today's shows, put on air with one tap. */
export default function RjShoutouts() {
  const [rows, setRows] = useState<Shoutout[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => setRows(await api<Shoutout[]>("/ads/shoutouts/rj")), []);
  useEffect(() => {
    load().catch(() => undefined);
    const timer = setInterval(() => load().catch(() => undefined), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  if (!rows.length) return null;

  async function onAir(s: Shoutout) {
    setBusy(s.id);
    setError("");
    try {
      await api(`/ads/${s.id}/on-air`, { method: "POST" });
      setMessage(`${s.businessName} is on your show card now.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not put it on air.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-green-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-zinc-900">Shout-outs for your shows</h2>
      <p className="mt-1 text-sm text-zinc-600">Read it on air, then tap Put on air so listeners see it on your show card.</p>
      {message ? <Notice kind="ok" text={message} /> : null}
      {error ? <Notice kind="error" text={error} /> : null}
      <ul className="mt-3 space-y-3">
        {rows.map((s) => (
          <li key={s.id} className="rounded-xl bg-green-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-800">{s.programmeName} · {clock(s.startsAt)}</p>
            <p className="font-semibold text-zinc-900">{s.businessName}: {s.title}</p>
            <p className="text-sm text-zinc-700">{s.offerText}</p>
            {s.live ? (
              <button type="button" disabled={busy !== null} onClick={() => void onAir(s)} className={`${primaryButton} mt-2`}>
                <Mic size={14} aria-hidden="true" /> {s.activatedAt ? "Put on air again" : "Put on air"}
              </button>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">You can put it on air when the show starts.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
