"use client";

/** Small shared pieces for the signed-in dashboards. */
export const API = "http://localhost:3000";

export const inputClass =
  "min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
export const labelClass = "mb-1.5 block text-sm font-medium text-zinc-800";
export const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-orange-600 px-5 font-semibold text-white hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60";
export const quietButton =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-60";
export const dangerButton =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
    throw Object.assign(new Error(message || "Something went wrong. Please try again."), {
      status: response.status,
    });
  }
  return data as T;
}

/** Sends a signed-out visitor to Google and brings them back to this page. */
export function signInAndReturn() {
  const path = window.location.pathname;
  sessionStorage.setItem("nowrjReturnTo", path);
  window.location.href = `${API}/auth/google?returnTo=${encodeURIComponent(path)}`;
}

export async function isSignedIn(): Promise<boolean> {
  const res = await fetch(`${API}/auth/me`, { credentials: "include", cache: "no-store" });
  return res.ok;
}

export function Notice({ kind, text }: { kind: "error" | "ok" | "info"; text: string }) {
  const tone =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : kind === "ok"
        ? "border-green-200 bg-green-50 text-green-800"
        : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`mt-4 rounded-lg border p-3 text-sm ${tone}`}>
      {text}
    </p>
  );
}

export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      {title ? <h2 className="text-lg font-bold text-zinc-900">{title}</h2> : null}
      {children}
    </section>
  );
}

export function StatusPill({ text, tone }: { text: string; tone: "green" | "amber" | "red" | "zinc" }) {
  const map = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
    zinc: "bg-zinc-100 text-zinc-700",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${map[tone]}`}>{text}</span>;
}
