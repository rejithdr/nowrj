"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, LoaderCircle, ShoppingBag } from "lucide-react";
import AuthControls from "../AuthControls";
import { api, Card, isSignedIn, Notice, primaryButton, signInAndReturn } from "../lib/ui";

type Thread = { kind: "programme" | "ad"; id: string; title: string; href: string; lastText: string; lastFrom: string; lastAt: string; unread: number; closed: boolean };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** All of a listener's conversations: private messages to programmes and enquiries to businesses. */
export default function MessagesPage() {
  const [signedIn, setSignedIn] = useState(true);
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!(await isSignedIn())) {
        setSignedIn(false);
        return;
      }
      try {
        setThreads(await api<Thread[]>("/me/messages"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load your messages.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 hover:underline">
            <ArrowLeft size={16} aria-hidden="true" /> Back to NowRJ
          </Link>
          <AuthControls />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">My messages</h1>
        <p className="text-sm text-zinc-600">Your private messages to programmes and your enquiries to businesses. Open one to read and reply.</p>
        {!signedIn ? (
          <Card>
            <p className="text-zinc-700">Sign in to see your messages.</p>
            <button type="button" onClick={signInAndReturn} className={`${primaryButton} mt-4`}>Sign in with Google</button>
          </Card>
        ) : error ? (
          <Notice kind="error" text={error} />
        ) : !threads ? (
          <p className="mt-6 text-zinc-600"><LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />Loading…</p>
        ) : threads.length === 0 ? (
          <Card>
            <p className="text-zinc-700">No messages yet. Use &ldquo;Private message to the team&rdquo; on a programme page, or &ldquo;I&apos;m interested&rdquo; on an ad.</p>
          </Card>
        ) : (
          <ul className="mt-4 space-y-2">
            {threads.map((t) => (
              <li key={`${t.kind}-${t.id}`}>
                <a href={t.href} className={`block rounded-xl border bg-white p-4 hover:border-orange-300 ${t.unread ? "border-orange-300" : "border-zinc-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1.5 font-semibold text-zinc-900">
                      {t.kind === "programme" ? <Lock size={14} className="shrink-0 text-zinc-500" aria-hidden="true" /> : <ShoppingBag size={14} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                      <span className="truncate">{t.title}</span>
                    </p>
                    {t.unread ? (
                      <span className="shrink-0 rounded-full bg-orange-600 px-2 py-0.5 text-xs font-bold text-white">{t.unread} new</span>
                    ) : t.closed ? (
                      <span className="shrink-0 text-xs text-zinc-500">Stopped</span>
                    ) : null}
                  </div>
                  <p className={`mt-1 line-clamp-2 text-sm ${t.unread ? "text-zinc-900" : "text-zinc-600"}`}>
                    <span className="font-medium">{t.lastFrom}:</span> {t.lastText}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{when(t.lastAt)}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
