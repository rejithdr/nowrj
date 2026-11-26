"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Lock, Mic, Phone, Send, UserPlus } from "lucide-react";
import { api, Notice, StatusPill } from "./ui";

type Request = {
  id: string;
  kind: "take_part" | "nominate";
  note: string | null;
  contactPhone: string | null;
  nomineeName: string | null;
  nomineePhone: string | null;
  status: "new" | "contacted" | "agreed" | "declined" | "done";
  agreedAt: string | null;
  createdAt: string;
  phonesClearedAt: string | null;
  listenerName: string | null;
  programmeName: string;
  stationName: string | null;
  guestName: string | null;
};
type Reply = { id: string; asLabel: string; body: string; createdAt: string };
type Comment = { id: string; body: string; createdAt: string; seen: boolean; listenerName: string | null; programmeName: string; stationName: string | null; replies: Reply[] };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const STATUS: Record<Request["status"], { text: string; tone: "green" | "amber" | "red" | "zinc" }> = {
  new: { text: "New", tone: "amber" },
  contacted: { text: "Contacted", tone: "zinc" },
  agreed: { text: "Agreed to be on air", tone: "green" },
  declined: { text: "Declined", tone: "red" },
  done: { text: "Done / aired", tone: "green" },
};

const small = "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold disabled:opacity-50";

/**
 * The programme team's inbox: listeners asking to take part, nominations,
 * and private messages. `query` says whose: "as=rj", "as=station&stationId=…"
 * or "as=network&organisationId=…".
 */
export default function TeamInbox({ query }: { query: string }) {
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [replyAs, setReplyAs] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([
        api<{ canEdit: boolean; requests: Request[] }>(`/participation/team?${query}`),
        api<{ canEdit: boolean; replyAs: string; comments: Comment[] }>(`/comments/team?${query}`),
      ]);
      setRequests(r.requests);
      setComments(c.comments);
      setCanEdit(r.canEdit);
      setReplyAs(c.replyAs);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the inbox.");
    }
  }, [query]);

  useEffect(() => {
    // Loaded after the first paint (not inside the effect body).
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function setStatus(id: string, status: Request["status"]) {
    setBusy(id);
    setError("");
    try {
      await api(`/participation/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  async function reply(id: string) {
    const body = drafts[id]?.trim();
    if (!body) return;
    setBusy(id);
    setError("");
    try {
      await api(`/comments/${id}/replies?${query}`, { method: "POST", body: JSON.stringify({ body }) });
      setDrafts((d) => ({ ...d, [id]: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reply.");
    } finally {
      setBusy(null);
    }
  }

  if (!requests || !comments) {
    return error ? <Notice kind="error" text={error} /> : <p className="mt-3 text-sm text-zinc-600"><LoaderCircle className="mr-2 inline animate-spin" size={16} aria-hidden="true" />Loading…</p>;
  }

  const open = requests.filter((r) => ["new", "contacted", "agreed"].includes(r.status));
  const closed = requests.filter((r) => !["new", "contacted", "agreed"].includes(r.status));

  return (
    <div className="mt-3 space-y-6">
      {error ? <Notice kind="error" text={error} /> : null}

      <div>
        <h3 className="font-semibold text-zinc-900">Taking part &amp; nominations</h3>
        <p className="text-sm text-zinc-600">
          Call each person before they go on air. A nominated person must agree first: mark <strong>Agreed</strong> after you&apos;ve asked them. Numbers are deleted after 30 days.
        </p>
        {requests.length === 0 ? <p className="mt-2 text-sm text-zinc-500">Nothing yet.</p> : null}
        <ul className="mt-2 divide-y divide-zinc-100">
          {[...open, ...closed].map((r) => (
            <li key={r.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900">
                    {r.kind === "nominate" ? <UserPlus size={14} className="mr-1 inline" aria-hidden="true" /> : <Mic size={14} className="mr-1 inline" aria-hidden="true" />}
                    {r.kind === "nominate" ? `${r.nomineeName}, nominated by ${r.listenerName ?? "a listener"}` : `${r.listenerName ?? "A listener"} wants to take part`}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {r.programmeName}{r.stationName ? ` · ${r.stationName}` : ""}{r.guestName ? ` · guest recording with ${r.guestName}` : ""} · {when(r.createdAt)}
                  </p>
                  {r.note ? <p className="mt-1 text-zinc-800">&ldquo;{r.note}&rdquo;</p> : null}
                  {r.kind === "nominate" && r.nomineePhone ? (
                    <a href={`tel:${r.nomineePhone}`} className="mt-1 inline-flex items-center gap-1 font-semibold text-orange-700"><Phone size={13} aria-hidden="true" />{r.nomineeName}: {r.nomineePhone}</a>
                  ) : null}
                  {r.contactPhone ? (
                    <a href={`tel:${r.contactPhone}`} className="ml-0 mt-1 flex items-center gap-1 font-semibold text-orange-700 sm:ml-0"><Phone size={13} aria-hidden="true" />{r.kind === "nominate" ? "Nominated by" : r.listenerName ?? "Listener"}: {r.contactPhone}</a>
                  ) : null}
                  {r.phonesClearedAt ? <p className="mt-1 text-xs text-zinc-500">Phone numbers deleted after 30 days.</p> : !canEdit ? <p className="mt-1 text-xs text-zinc-500">Phone numbers are shown to staff who can edit programmes.</p> : null}
                </div>
                <StatusPill text={STATUS[r.status].text} tone={STATUS[r.status].tone} />
              </div>
              {canEdit ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.status === "new" ? <button type="button" disabled={busy === r.id} onClick={() => void setStatus(r.id, "contacted")} className={`${small} border-zinc-300 text-zinc-700`}>Contacted</button> : null}
                  {r.status !== "agreed" && r.status !== "done" ? <button type="button" disabled={busy === r.id} onClick={() => void setStatus(r.id, "agreed")} className={`${small} border-emerald-300 text-emerald-800`}>Agreed</button> : null}
                  {r.status !== "declined" && r.status !== "done" ? <button type="button" disabled={busy === r.id} onClick={() => void setStatus(r.id, "declined")} className={`${small} border-red-200 text-red-700`}>Declined / not picked</button> : null}
                  {r.status !== "done" && (r.kind === "take_part" || r.status === "agreed") ? <button type="button" disabled={busy === r.id} onClick={() => void setStatus(r.id, "done")} className={`${small} border-zinc-300 text-zinc-700`}>Done / aired</button> : null}
                  {r.status !== "new" ? <button type="button" disabled={busy === r.id} onClick={() => void setStatus(r.id, "new")} className={`${small} border-zinc-200 text-zinc-500`}>Undo</button> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="flex items-center gap-1.5 font-semibold text-zinc-900"><Lock size={15} aria-hidden="true" /> Private messages</h3>
        <p className="text-sm text-zinc-600">Only the listener and the programme team see these. {canEdit ? `Your replies are signed “${replyAs}”.` : ""}</p>
        {comments.length === 0 ? <p className="mt-2 text-sm text-zinc-500">No messages yet.</p> : null}
        <ul className="mt-2 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
              <p className="text-xs text-zinc-500">
                {c.listenerName ?? "A listener"} · {c.programmeName}{c.stationName ? ` · ${c.stationName}` : ""} · {when(c.createdAt)}
                {!c.seen ? <span className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-800">New</span> : null}
              </p>
              <p className="mt-1 text-zinc-900">{c.body}</p>
              {c.replies.map((r) => (
                <div key={r.id} className="mt-2 rounded-lg border-l-4 border-orange-300 bg-orange-50/40 p-2">
                  <p className="text-xs font-semibold text-orange-800">{r.asLabel} · {when(r.createdAt)}</p>
                  <p className="text-zinc-900">{r.body}</p>
                </div>
              ))}
              {canEdit ? (
                <div className="mt-2 flex gap-2">
                  <label htmlFor={`reply-${c.id}`} className="sr-only">Reply</label>
                  <input
                    id={`reply-${c.id}`}
                    maxLength={500}
                    value={drafts[c.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    placeholder="Reply privately…"
                    className="min-h-10 w-full rounded-lg border border-zinc-300 px-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                  <button type="button" disabled={busy === c.id || !(drafts[c.id] ?? "").trim()} onClick={() => void reply(c.id)} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-orange-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
                    <Send size={14} aria-hidden="true" /> Reply
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
