"use client";

import { useState } from "react";
import { Check, Heart, Info, LoaderCircle, MessageCircle, MessageCircleQuestion, Music } from "lucide-react";
import { api, inputClass, signInAndReturn } from "./lib/ui";
import { DEFAULT_QUESTION_NOTICE, hasContactDetails, wording, type InteractionType, type MessageKind } from "./lib/interaction";

type MyRequest = {
  id: string;
  kind?: MessageKind;
  songTitle: string | null;
  artist: string | null;
  message: string | null;
  dedicatedTo?: string | null;
  status: string;
  seenBy?: "rj" | "station" | null;
  /** Guest sessions: the question is for the guest or the RJ. */
  askedOf?: "guest" | "rj";
};

type NameOnAir = "display" | "first" | "none";

/** The listener's last on-air choices, so they pick them once. */
const PREF_KEY = "nowrj_on_air";
function loadPrefs(): { nameOnAir: NameOnAir; okOnAir: boolean | null } {
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}");
    return {
      nameOnAir: ["display", "first", "none"].includes(saved.nameOnAir) ? saved.nameOnAir : "display",
      okOnAir: typeof saved.okOnAir === "boolean" ? saved.okOnAir : null,
    };
  } catch {
    return { nameOnAir: "display", okOnAir: null };
  }
}
function savePrefs(nameOnAir: NameOnAir, okOnAir: boolean) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ nameOnAir, okOnAir }));
  } catch {
    /* private browsing: ask again next time */
  }
}

const DONE: Record<MessageKind, string> = {
  song: "Played ✓",
  dedication: "Read on air ✓",
  message: "Read on air ✓",
  question: "Answered on air ✓",
};
const NOT_DONE: Record<MessageKind, string> = {
  song: "Not played this time",
  dedication: "Not read this time",
  message: "Not read this time",
  question: "Not answered this time",
};
/** Guest questions (Ask the guest): "played" means used in the recording. */
const guestStatusText: Record<string, string> = { new: "Asked", played: "Used in the recording ✓", skipped: "Not used this time" };

function statusText(r: MyRequest) {
  const kind = r.kind ?? "song";
  if (r.status === "played") return DONE[kind];
  if (r.status === "skipped") return NOT_DONE[kind];
  if (r.seenBy === "rj") return "Seen by RJ";
  if (r.seenBy === "station") return "Seen by the station";
  return "Sent";
}

const KINDS: { kind: Exclude<MessageKind, "question">; label: string; Icon: typeof Music }[] = [
  { kind: "song", label: "Song request", Icon: Music },
  { kind: "dedication", label: "Dedication", Icon: Heart },
  { kind: "message", label: "Message", Icon: MessageCircle },
];

const emptyForm = { songTitle: "", artist: "", message: "", question: "", dedicatedTo: "" };

/**
 * Lets a signed-in listener send up to 3 song requests, dedications or
 * messages for one show (or questions when the programme is in "Ask a
 * question" mode), choose what may be read on air, and see what happened:
 * Sent, Seen by RJ, Read on air.
 */
export default function SongRequestButton({
  showId,
  programmeName,
  mode = "song",
  notice = null,
  guest = false,
}: {
  showId: string;
  programmeName: string;
  mode?: InteractionType;
  notice?: string | null;
  /** Ask the guest: `showId` is then a guest session id. */
  guest?: boolean;
}) {
  const words = wording[mode];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mine, setMine] = useState<MyRequest[]>([]);
  const [max, setMax] = useState(3);
  const [kind, setKind] = useState<Exclude<MessageKind, "question">>("song");
  const [form, setForm] = useState(emptyForm);
  const [displayName, setDisplayName] = useState("");
  const [nameOnAir, setNameOnAir] = useState<NameOnAir>("display");
  const [okOnAir, setOkOnAir] = useState<boolean | null>(null);
  const [askedOf, setAskedOf] = useState<"guest" | "rj">("guest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  const base = guest ? `/guest-sessions/${showId}/questions` : `/shows/${showId}/song-requests`;

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const me = await api<{ displayName: string | null }>("/auth/me").catch(() => null);
      if (!me) {
        signInAndReturn();
        return;
      }
      setDisplayName((me.displayName ?? "").trim());
      const prefs = loadPrefs();
      setNameOnAir(prefs.nameOnAir);
      setOkOnAir(prefs.okOnAir);
      const data = await api<{ max: number; requests: MyRequest[] }>(`${base}/mine`);
      setMine(data.requests);
      setMax(data.max);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not open ${words.items}.`);
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSent("");
    if (okOnAir === null) {
      setError("Choose whether this may be read on air.");
      return;
    }
    const text = mode === "question" ? [form.question] : [form.songTitle, form.artist, form.message, form.dedicatedTo];
    if (text.some(hasContactDetails)) {
      setError("Please remove phone numbers, email addresses and links.");
      return;
    }
    setBusy(true);
    try {
      const consent = { nameOnAir, okOnAir };
      const body =
        mode === "question"
          ? { question: form.question, ...consent, ...(guest ? { askedOf } : {}) }
          : kind === "song"
            ? { kind, songTitle: form.songTitle, artist: form.artist, message: form.message, ...consent }
            : kind === "dedication"
              ? { kind, dedicatedTo: form.dedicatedTo, message: form.message, songTitle: form.songTitle, artist: form.artist, ...consent }
              : { kind, message: form.message, ...consent };
      const created = await api<MyRequest>(base, { method: "POST", body: JSON.stringify(body) });
      savePrefs(nameOnAir, okOnAir);
      setMine((all) => [...all, created]);
      setSent(
        mode === "question"
          ? "Your question has been sent."
          : kind === "song"
            ? `Sent “${created.songTitle}” to the RJ.`
            : kind === "dedication"
              ? `Your dedication for ${created.dedicatedTo} has been sent.`
              : "Your message has been sent.",
      );
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not send your ${words.item}.`);
    } finally {
      setBusy(false);
    }
  }

  const left = max - mine.length;
  const firstName = displayName.split(/\s+/)[0];
  const nameChoices: { value: NameOnAir; label: string }[] = [
    ...(displayName ? [{ value: "display" as const, label: displayName }] : []),
    ...(firstName && firstName !== displayName ? [{ value: "first" as const, label: `${firstName} only` }] : []),
    { value: "none", label: "Don't say my name" },
  ];
  const chip = (on: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm ${on ? "border-orange-400 bg-orange-50 font-semibold text-orange-800" : "border-zinc-300 bg-white text-zinc-700"}`;
  const field = (id: string, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-zinc-700">{label}</label>
      {input}
      {hint ? <p className="mt-1 text-right text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
        disabled={loading}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {loading ? (
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
        ) : mode === "question" ? (
          <MessageCircleQuestion size={16} aria-hidden="true" />
        ) : (
          <Music size={16} aria-hidden="true" />
        )}
        {guest ? "Ask the guest or RJ" : words.button}
      </button>

      {error && !open ? <p className="w-full text-sm text-red-700" role="alert">{error}</p> : null}

      {open ? (
        <div className="w-full rounded-xl bg-zinc-50 p-3">
          {mine.length ? (
            <ul className="mb-3 space-y-1 text-sm">
              {mine.map((r) => {
                const k = r.kind ?? "song";
                const what =
                  k === "song"
                    ? r.songTitle
                    : k === "dedication"
                      ? `For ${r.dedicatedTo}: “${r.message}”`
                      : `${guest ? (r.askedOf === "rj" ? "To the RJ: " : "To the guest: ") : ""}“${r.message}”`;
                return (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="min-w-0 text-zinc-900">
                      {what}
                      {k === "song" && r.artist ? <span className="text-zinc-500"> · {r.artist}</span> : null}
                    </span>
                    <span className={`shrink-0 ${r.status === "played" ? "font-semibold text-emerald-700" : r.seenBy ? "text-zinc-800" : "text-zinc-500"}`}>
                      {guest ? guestStatusText[r.status] ?? r.status : statusText(r)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {left > 0 ? (
            <form onSubmit={submit} className="space-y-3">
              {mode === "question" ? (
                <>
                  {/* Guest sessions show a notice only when the programme set one (e.g. a doctor's talk). */}
                  {!guest || notice?.trim() ? (
                    <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-900">
                      <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{notice?.trim() || DEFAULT_QUESTION_NOTICE}</span>
                    </p>
                  ) : null}
                  {guest ? (
                    <div role="radiogroup" aria-label="Who is your question for?" className="flex flex-wrap gap-2">
                      <button type="button" role="radio" aria-checked={askedOf === "guest"} onClick={() => setAskedOf("guest")} className={chip(askedOf === "guest")}>
                        {askedOf === "guest" ? <Check size={14} aria-hidden="true" /> : null} For the guest
                      </button>
                      <button type="button" role="radio" aria-checked={askedOf === "rj"} onClick={() => setAskedOf("rj")} className={chip(askedOf === "rj")}>
                        {askedOf === "rj" ? <Check size={14} aria-hidden="true" /> : null} For the RJ
                      </button>
                    </div>
                  ) : null}
                  {field(
                    `q-${showId}`,
                    "Your question *",
                    <textarea id={`q-${showId}`} required maxLength={200} rows={3} value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} className={`${inputClass} py-2`} />,
                    `${form.question.length}/200 · no phone numbers or links`,
                  )}
                </>
              ) : (
                <>
                  <div role="radiogroup" aria-label="What do you want to send?" className="flex flex-wrap gap-2">
                    {KINDS.map(({ kind: k, label, Icon }) => (
                      <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
                        <Icon size={14} aria-hidden="true" /> {label}
                      </button>
                    ))}
                  </div>

                  {kind === "dedication"
                    ? field(
                        `to-${showId}`,
                        "For whom? *",
                        <input id={`to-${showId}`} required maxLength={60} value={form.dedicatedTo} onChange={(e) => setForm((f) => ({ ...f, dedicatedTo: e.target.value }))} placeholder="Amma, my friends at college…" className={inputClass} />,
                      )
                    : null}

                  {kind === "song" || kind === "dedication" ? (
                    <>
                      {field(
                        `song-${showId}`,
                        kind === "song" ? "Song *" : "Song (optional)",
                        <input id={`song-${showId}`} required={kind === "song"} maxLength={150} value={form.songTitle} onChange={(e) => setForm((f) => ({ ...f, songTitle: e.target.value }))} className={inputClass} />,
                      )}
                      {field(
                        `artist-${showId}`,
                        "Artist or film",
                        <input id={`artist-${showId}`} maxLength={150} value={form.artist} onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))} className={inputClass} />,
                      )}
                    </>
                  ) : null}

                  {kind === "song"
                    ? field(
                        `msg-${showId}`,
                        "Message (optional)",
                        <input id={`msg-${showId}`} maxLength={200} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} className={inputClass} />,
                      )
                    : field(
                        `msg-${showId}`,
                        kind === "dedication" ? "Your dedication *" : "Your message *",
                        <textarea
                          id={`msg-${showId}`}
                          required
                          rows={2}
                          maxLength={kind === "dedication" ? 140 : 200}
                          value={form.message}
                          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                          placeholder={kind === "dedication" ? "Happy birthday, Amma!" : "Good morning from Kunnamkulam!"}
                          className={`${inputClass} py-2`}
                        />,
                        `${form.message.length}/${kind === "dedication" ? 140 : 200} · no phone numbers or links`,
                      )}
                </>
              )}

              <fieldset className="rounded-lg border border-zinc-200 bg-white p-3">
                <legend className="px-1 text-xs font-semibold text-zinc-700">On air</legend>
                <div role="radiogroup" aria-label="May this be read on air?" className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" role="radio" aria-checked={okOnAir === true} onClick={() => setOkOnAir(true)} className={chip(okOnAir === true)}>
                    {okOnAir === true ? <Check size={14} aria-hidden="true" /> : null} OK to read on air
                  </button>
                  <button type="button" role="radio" aria-checked={okOnAir === false} onClick={() => setOkOnAir(false)} className={chip(okOnAir === false)}>
                    {okOnAir === false ? <Check size={14} aria-hidden="true" /> : null} Just for the RJ, don&apos;t read it out
                  </button>
                </div>
                {okOnAir ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-medium text-zinc-700">Name to read out</p>
                    <div role="radiogroup" aria-label="Name to read out" className="flex flex-wrap gap-2">
                      {nameChoices.map((c) => (
                        <button key={c.value} type="button" role="radio" aria-checked={nameOnAir === c.value} onClick={() => setNameOnAir(c.value)} className={chip(nameOnAir === c.value)}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </fieldset>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
                  {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                  Send to {programmeName}
                </button>
                <span className="text-xs text-zinc-500">{left} of {max} left for this {guest ? "guest" : "show"}</span>
              </div>
            </form>
          ) : (
            <p className="text-sm text-zinc-600">You&apos;ve sent all {max} for this {guest ? "guest" : "show"}.</p>
          )}
          {sent ? <p className="mt-2 text-sm text-emerald-700" role="status">{sent}</p> : null}
          {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </>
  );
}
