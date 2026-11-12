"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Archive, Check, ChevronDown, ChevronUp, Copy, FileUp, ImagePlus, LoaderCircle, MessageCircle, Pencil, Plus, Printer } from "lucide-react";
import { API_URL } from "./config";
import StationCampaigns from "./station-campaigns";
import { api, inputClass, labelClass, Notice, primaryButton, quietButton, StatusPill } from "./ui";

type Consent = { status: "valid" | "pending_check" | "withdrawn" | "rejected" | "none"; kind: string | null; since: string | null; note?: string | null };
type Advertiser = {
  id: string;
  businessName: string;
  contactName: string;
  contactPhone: string | null;
  email: string;
  linkStatus: "invited" | "active";
  accounts: number;
  creatives: number;
  openSuggestions: number;
  invite: { token: string; expiresAt: string } | null;
  consent: Consent;
};
type Suggestion = { id: string; text: string; status: "open" | "done"; createdAt: string };
export type Creative = {
  id: string;
  title: string;
  offerText: string;
  address: string | null;
  timings: string | null;
  phone: string | null;
  website: string | null;
  hasImage: boolean;
  updatedAt: string;
  stationName?: string;
  suggestions: Suggestion[];
};

export const CONSENT_TEXT: Record<Consent["status"], { text: string; tone: "green" | "amber" | "red" | "zinc" }> = {
  valid: { text: "Consent given", tone: "green" },
  pending_check: { text: "Scan waiting for NowRJ check", tone: "amber" },
  withdrawn: { text: "Consent withdrawn", tone: "red" },
  rejected: { text: "Scan not accepted", tone: "red" },
  none: { text: "No consent yet", tone: "amber" },
};

const inviteLink = (token: string) => `${typeof window === "undefined" ? "" : window.location.origin}/advertiser-invite/${token}`;

/** Shrinks an image in the browser to at most 1200 px wide, as JPEG. */
async function shrink(file: File, max = 1200): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not process this image.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process this image."))), "image/jpeg", 0.85));
}

async function upload(path: string, field: string, blob: Blob, name: string) {
  const form = new FormData();
  form.append(field, blob, name);
  const response = await fetch(`${API_URL}${path}`, { method: "POST", body: form, credentials: "include" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Upload failed.");
  return data;
}

/** How a creative looks to listeners (the ad page comes in release 5). */
export function CreativeCard({ creative }: { creative: Creative }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {creative.hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${API_URL}/ad-creatives/${creative.id}/image?v=${encodeURIComponent(creative.updatedAt)}`} alt="" className="aspect-[2/1] w-full object-cover" />
      ) : null}
      <div className="p-3">
        <p className="font-semibold text-zinc-900">{creative.title}</p>
        <p className="mt-1 text-sm text-zinc-700">{creative.offerText}</p>
        <p className="mt-2 text-xs text-zinc-500">
          {[creative.address, creative.timings, creative.phone, creative.website?.replace(/^https?:\/\//, "").replace(/\/$/, "")].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

/** The station's advertisers and their ad library. */
export default function StationAds({ stationId }: { stationId: string }) {
  const [data, setData] = useState<{ canEdit: boolean; advertisers: Advertiser[] } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const base = `/stations/${stationId}/ads`;

  const load = useCallback(async () => {
    setData(await api(`${base}/advertisers`));
  }, [base]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Could not load advertisers."));
  }, [load]);

  if (!data) return error ? <Notice kind="error" text={error} /> : null;

  return (
    <div>
      <p className="mt-1 text-sm text-zinc-600">
        Invite a business with its email. It must agree to the consent (on screen, or on the{" "}
        <a href="/advertiser-consent-form" target="_blank" className="font-semibold text-orange-700 hover:underline">printed form</a>) before any ad can run.
      </p>
      {message ? <Notice kind="ok" text={message} /> : null}
      {error ? <Notice kind="error" text={error} /> : null}
      {data.advertisers.length === 0 ? <p className="mt-3 text-sm text-zinc-600">No advertisers yet.</p> : null}
      <ul className="mt-3 space-y-3">
        {data.advertisers.map((a) => (
          <li key={a.id} className="rounded-xl border border-zinc-200">
            <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left">
              <span className="min-w-0">
                <span className="block font-semibold text-zinc-900">{a.businessName}</span>
                <span className="block text-sm text-zinc-600">
                  {a.contactName} · {a.creatives} creative{a.creatives === 1 ? "" : "s"}
                  {a.openSuggestions ? <span className="font-semibold text-orange-700"> · {a.openSuggestions} suggestion{a.openSuggestions === 1 ? "" : "s"}</span> : null}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <StatusPill text={CONSENT_TEXT[a.consent.status].text} tone={CONSENT_TEXT[a.consent.status].tone} />
                {a.linkStatus === "invited" ? <StatusPill text="Not joined yet" tone="zinc" /> : null}
                {open === a.id ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
              </span>
            </button>
            {open === a.id ? (
              <AdvertiserPanel stationId={stationId} advertiser={a} canEdit={data.canEdit} onChanged={load} onMessage={setMessage} onError={setError} />
            ) : null}
          </li>
        ))}
      </ul>
      {data.canEdit ? (
        adding ? (
          <InviteForm
            base={base}
            onDone={async (msg) => {
              setAdding(false);
              if (msg) setMessage(msg);
              await load();
            }}
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={`${quietButton} mt-3`}>
            <Plus size={14} aria-hidden="true" /> Invite an advertiser
          </button>
        )
      ) : null}

      <h3 className="mt-6 font-bold text-zinc-900">Ads</h3>
      <StationCampaigns stationId={stationId} advertisers={data.advertisers.map((a) => ({ id: a.id, businessName: a.businessName }))} />
    </div>
  );
}

function InviteForm({ base, onDone }: { base: string; onDone: (message?: string) => Promise<void> }) {
  const [form, setForm] = useState({ businessName: "", contactName: "", contactPhone: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ businessName: string; existing: boolean }>(`${base}/advertisers`, { method: "POST", body: JSON.stringify(form) });
      await onDone(
        r.existing
          ? `${r.businessName} already advertises on NowRJ, so it is now linked to your station too. Send them the invite link to confirm.`
          : `${r.businessName} added. Copy their invite link and send it to them.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl bg-zinc-50 p-4 sm:grid-cols-2">
      <div>
        <label htmlFor="adv-name" className={labelClass}>Business name</label>
        <input id="adv-name" required maxLength={150} value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label htmlFor="adv-contact" className={labelClass}>Contact person</label>
        <input id="adv-contact" required maxLength={100} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label htmlFor="adv-email" className={labelClass}>Email (their Google account)</label>
        <input id="adv-email" type="email" required maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label htmlFor="adv-phone" className={labelClass}>Phone (optional)</label>
        <input id="adv-phone" type="tel" maxLength={20} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className={inputClass} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} Invite
        </button>
        <button type="button" className={quietButton} onClick={() => void onDone()}>Cancel</button>
      </div>
      {error ? <p className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
    </form>
  );
}

function AdvertiserPanel({
  stationId,
  advertiser: a,
  canEdit,
  onChanged,
  onMessage,
  onError,
}: {
  stationId: string;
  advertiser: Advertiser;
  canEdit: boolean;
  onChanged: () => Promise<void>;
  onMessage: (m: string) => void;
  onError: (m: string) => void;
}) {
  const base = `/stations/${stationId}/ads`;
  const [creatives, setCreatives] = useState<Creative[] | null>(null);
  const [editing, setEditing] = useState<Creative | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const scanInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setCreatives(await api<Creative[]>(`${base}/advertisers/${a.id}/creatives`));
  }, [base, a.id]);

  useEffect(() => {
    load().catch(() => setCreatives([]));
  }, [load]);

  async function act(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    onError("");
    try {
      await action();
      onMessage(done);
      await Promise.all([load(), onChanged()]);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", inviteLink(token));
    }
  }

  return (
    <div className="border-t border-zinc-100 p-3">
      <p className="text-sm text-zinc-600">
        {a.email}
        {a.contactPhone ? ` · ${a.contactPhone}` : ""} · {a.accounts ? `${a.accounts} account${a.accounts === 1 ? "" : "s"} signed in` : "has not signed in yet"}
      </p>
      {a.consent.status === "rejected" && a.consent.note ? <p className="mt-1 text-sm text-red-700">NowRJ team: {a.consent.note}</p> : null}

      {canEdit ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {a.invite ? (
            <>
              <button type="button" className={quietButton} onClick={() => void copy(a.invite!.token)}>
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? "Copied" : "Copy invite link"}
              </button>
              <a
                className={quietButton}
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`${a.businessName}: you're invited to advertise on NowRJ. Sign in with ${a.email}: ${inviteLink(a.invite.token)}`)}`}
              >
                <MessageCircle size={14} aria-hidden="true" /> WhatsApp
              </a>
            </>
          ) : a.linkStatus === "invited" ? (
            <button type="button" disabled={busy} className={quietButton} onClick={() => void act(() => api(`${base}/advertisers/${a.id}/invite`, { method: "POST" }), "New invite link created.")}>
              New invite link
            </button>
          ) : null}
          {a.consent.status !== "valid" && a.consent.status !== "pending_check" ? (
            <>
              <a href="/advertiser-consent-form" target="_blank" className={quietButton}>
                <Printer size={14} aria-hidden="true" /> Print consent form
              </a>
              <button type="button" disabled={busy} className={quietButton} onClick={() => scanInput.current?.click()}>
                <FileUp size={14} aria-hidden="true" /> Upload signed scan
              </button>
              <input
                ref={scanInput}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void act(() => upload(`${base}/advertisers/${a.id}/consent-scan`, "scan", file, file.name), "Scan uploaded. The NowRJ team will check it.");
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}

      <h3 className="mt-4 font-bold text-zinc-900">Ad library</h3>
      {creatives === null ? (
        <p className="mt-2 text-sm text-zinc-600"><LoaderCircle size={14} className="mr-1 inline animate-spin" aria-hidden="true" />Loading…</p>
      ) : creatives.length === 0 && editing !== "new" ? (
        <p className="mt-2 text-sm text-zinc-600">No creatives yet.</p>
      ) : null}
      <ul className="mt-2 grid gap-3 sm:grid-cols-2">
        {(creatives ?? []).map((c) =>
          editing !== "new" && editing?.id === c.id ? (
            <li key={c.id} className="sm:col-span-2">
              <CreativeForm base={base} advertiserId={a.id} creative={c} onDone={async (msg) => { setEditing(null); if (msg) onMessage(msg); await load(); }} />
            </li>
          ) : (
            <li key={c.id}>
              <CreativeCard creative={c} />
              {c.suggestions.filter((s) => s.status === "open").map((s) => (
                <div key={s.id} className="mt-2 rounded-lg bg-orange-50 p-2 text-sm text-zinc-800">
                  <span className="font-semibold">Advertiser suggests:</span> {s.text}
                  {canEdit ? (
                    <button type="button" disabled={busy} className="ml-2 font-semibold text-orange-700 hover:underline" onClick={() => void act(() => api(`${base}/suggestions/${s.id}/done`, { method: "POST" }), "Marked as done.")}>
                      Mark done
                    </button>
                  ) : null}
                </div>
              ))}
              {canEdit ? (
                <div className="mt-2 flex gap-3 text-sm">
                  <button type="button" className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline" onClick={() => setEditing(c)}>
                    <Pencil size={13} aria-hidden="true" /> Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex items-center gap-1 font-semibold text-zinc-600 hover:underline"
                    onClick={() => window.confirm(`Archive “${c.title}”? It leaves the library.`) && void act(() => api(`${base}/creatives/${c.id}/archive`, { method: "POST" }), "Creative archived.")}
                  >
                    <Archive size={13} aria-hidden="true" /> Archive
                  </button>
                </div>
              ) : null}
            </li>
          ),
        )}
      </ul>
      {canEdit ? (
        editing === "new" ? (
          <CreativeForm base={base} advertiserId={a.id} onDone={async (msg) => { setEditing(null); if (msg) onMessage(msg); await Promise.all([load(), onChanged()]); }} />
        ) : (
          <button type="button" onClick={() => setEditing("new")} className={`${quietButton} mt-3`}>
            <Plus size={14} aria-hidden="true" /> Add a creative
          </button>
        )
      ) : null}
    </div>
  );
}

function CreativeForm({ base, advertiserId, creative, onDone }: { base: string; advertiserId: string; creative?: Creative; onDone: (message?: string) => Promise<void> }) {
  const [form, setForm] = useState({
    title: creative?.title ?? "",
    offerText: creative?.offerText ?? "",
    address: creative?.address ?? "",
    timings: creative?.timings ?? "",
    phone: creative?.phone ?? "",
    website: creative?.website ?? "",
  });
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const id = creative
        ? (await api<{ id: string }>(`${base}/creatives/${creative.id}`, { method: "PATCH", body: JSON.stringify(form) })).id
        : (await api<{ id: string }>(`${base}/advertisers/${advertiserId}/creatives`, { method: "POST", body: JSON.stringify(form) })).id;
      if (image) await upload(`${base}/creatives/${id}/image`, "image", await shrink(image), "image.jpg");
      await onDone(creative ? "Creative saved." : "Creative added to the library.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string, max: number, opts: { required?: boolean; type?: string; long?: boolean } = {}) => (
    <div className={opts.long ? "sm:col-span-2" : undefined}>
      <label htmlFor={`cr-${key}`} className={labelClass}>{label}</label>
      {opts.long ? (
        <textarea id={`cr-${key}`} required={opts.required} maxLength={max} rows={3} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={inputClass} />
      ) : (
        <input id={`cr-${key}`} type={opts.type ?? "text"} required={opts.required} maxLength={max} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={inputClass} />
      )}
      {opts.long ? <p className="mt-1 text-xs text-zinc-500">{form[key].length}/{max}</p> : null}
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl bg-zinc-50 p-4 sm:grid-cols-2">
      {field("title", "Title", 100, { required: true })}
      {field("timings", "Timings (optional)", 150)}
      {field("offerText", "Offer", 300, { required: true, long: true })}
      {field("address", "Address (optional)", 300)}
      {field("phone", "Phone for the Call button", 20, { type: "tel" })}
      {field("website", "Website (optional)", 255)}
      <div>
        <label htmlFor="cr-image" className={labelClass}>Image {creative?.hasImage ? "(replace)" : "(optional)"}</label>
        <label htmlFor="cr-image" className={`${quietButton} cursor-pointer`}>
          <ImagePlus size={14} aria-hidden="true" /> {image ? image.name : "Choose image"}
        </label>
        <input id="cr-image" type="file" accept="image/*" className="hidden" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} Save
        </button>
        <button type="button" className={quietButton} onClick={() => void onDone()}>Cancel</button>
      </div>
      {error ? <p className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
    </form>
  );
}
