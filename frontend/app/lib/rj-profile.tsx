"use client";

import { useRef, useState } from "react";
import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { API, api, inputClass, labelClass, Notice, primaryButton, quietButton } from "./ui";

type Profile = { name: string; photoUrl?: string | null };

/** Turns any photo into a small square JPEG in the browser before uploading. */
async function squareJpeg(file: File, size = 480): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not process this photo.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not process this photo."))), "image/jpeg", 0.85),
  );
}

/** Lets an RJ change their name and profile photo. */
export function RjProfileEditor({ profile, onChange }: { profile: Profile; onChange: (p: Partial<Profile>) => void }) {
  const [name, setName] = useState(profile.name);
  const [busy, setBusy] = useState<"name" | "photo" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setBusy("name");
    setMessage(null);
    try {
      const saved = await api<{ name: string }>("/rjs/me", { method: "PATCH", body: JSON.stringify({ name }) });
      onChange({ name: saved.name });
      setName(saved.name);
      setMessage({ kind: "ok", text: "Name updated. Your programmes now show the new name." });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Could not save your name." });
    } finally {
      setBusy(null);
    }
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setBusy("photo");
    setMessage(null);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Please choose a photo.");
      const form = new FormData();
      form.append("photo", await squareJpeg(file), "photo.jpg");
      const response = await fetch(`${API}/rjs/me/photo`, { method: "POST", body: form, credentials: "include" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Could not upload the photo.");
      onChange({ photoUrl: data.photoUrl });
      setMessage({ kind: "ok", text: "Photo updated." });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Could not upload the photo." });
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removePhoto() {
    setBusy("photo");
    setMessage(null);
    try {
      await api("/rjs/me/photo", { method: "DELETE" });
      onChange({ photoUrl: null });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Could not remove the photo." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
      <div className="flex flex-col items-center gap-3">
        {profile.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.photoUrl} alt="Your profile photo" className="h-28 w-28 rounded-full object-cover" />
        ) : (
          <span className="flex h-28 w-28 items-center justify-center rounded-full bg-orange-100 text-4xl font-bold text-orange-700" aria-hidden="true">
            {profile.name.charAt(0).toUpperCase()}
          </span>
        )}
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => void uploadPhoto(e.target.files?.[0])} />
        <button type="button" className={quietButton} disabled={busy !== null} onClick={() => fileInput.current?.click()}>
          {busy === "photo" ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
          {profile.photoUrl ? "Change photo" : "Add photo"}
        </button>
        {profile.photoUrl ? (
          <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-red-700" disabled={busy !== null} onClick={() => void removePhoto()}>
            <Trash2 size={14} aria-hidden="true" /> Remove
          </button>
        ) : null}
      </div>

      <form onSubmit={saveName} className="flex-1">
        <label htmlFor="rj-name" className={labelClass}>RJ name</label>
        <input id="rj-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        <p className="mt-1.5 text-xs text-zinc-500">Shown on your profile and programmes. Your profile link stays the same.</p>
        <button type="submit" className={`${primaryButton} mt-3`} disabled={busy !== null || name.trim() === profile.name}>
          {busy === "name" ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
          Save name
        </button>
      </form>

      {message ? <div className="sm:basis-full"><Notice kind={message.kind} text={message.text} /></div> : null}
    </div>
  );
}
