
"use client";
import { API_URL } from "../../lib/config";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  LoaderCircle,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";

const API = API_URL;

type RJ = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  isActive: boolean;
  stationId: string | null;
  verificationStatus?: string;
};

type VerificationInfo = Record<
  string,
  { vouches: { voucherName: string; note: string | null }[]; referredBy: string | null }
>;

/** Referrer and vouches shown under an RJ's name, so the Super Admin can decide. */
function VerificationNotes({ info }: { info?: VerificationInfo[string] }) {
  if (!info || (!info.referredBy && info.vouches.length === 0)) return null;
  return (
    <div className="mt-1 space-y-0.5 text-xs text-zinc-600">
      {info.referredBy ? <p>Referred by {info.referredBy}</p> : null}
      {info.vouches.length ? (
        <p>
          Vouched for by{" "}
          {info.vouches.map((v, i) => (
            <span key={v.voucherName}>
              {i > 0 ? ", " : ""}
              <span className="font-semibold text-zinc-800">{v.voucherName}</span>
              {v.note ? <span className="text-zinc-500"> (“{v.note}”)</span> : null}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

type Station = {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  state?: string | null;
  isActive: boolean;
};

type RJForm = {
  name: string;
  slug: string;
  email: string;
  phone: string;
  photoUrl: string;
  stationId: string;
};

const emptyForm: RJForm = {
  name: "",
  slug: "",
  email: "",
  phone: "",
  photoUrl: "",
  stationId: "",
};

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    const message = data?.message;
    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string" && message.trim()) return message;
  } catch {
    // The response may not contain JSON.
  }

  if (response.status === 401) {
    return "You are not signed in. Sign in with your authorised superadmin account.";
  }
  if (response.status === 403) {
    return "Access denied. This account does not have superadmin access.";
  }
  return `Request failed (${response.status}). Please try again.`;
}

/** Self-registered RJs waiting for a decision, or rejected ones that can be reconsidered. */
function needsReview(rj: RJ) {
  return rj.verificationStatus === "pending" || rj.verificationStatus === "rejected";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminRJsPage() {
  const [rjs, setRjs] = useState<RJ[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RJ | null>(null);
  const [form, setForm] = useState<RJForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [changingId, setChangingId] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [verificationInfo, setVerificationInfo] = useState<VerificationInfo>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError("");
    setNotice("");

    try {
      const [rjResponse, stationResponse] = await Promise.all([
        fetch(`${API}/admin/rjs`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${API}/stations`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      if (!rjResponse.ok) {
        const message = await readError(rjResponse);
        setAccessDenied(rjResponse.status === 401 || rjResponse.status === 403);
        throw new Error(message);
      }

      if (!stationResponse.ok) {
        throw new Error(await readError(stationResponse));
      }

      const rjData: RJ[] = await rjResponse.json();
      const stationData: Station[] = await stationResponse.json();

      setRjs(Array.isArray(rjData) ? rjData : []);
      fetch(`${API}/admin/rjs-verification`, { credentials: "include", cache: "no-store" })
        .then((res) => (res.ok ? res.json() : {}))
        .then((info: VerificationInfo) => setVerificationInfo(info))
        .catch(() => setVerificationInfo({}));
      setStations(Array.isArray(stationData) ? stationData : []);
      setAccessDenied(false);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to load RJ management data. Check that the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stationById = useMemo(
    () => new Map(stations.map((station) => [station.id, station])),
    [stations],
  );

  const filteredRJs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rjs.filter((rj) => {
      const station = rj.stationId ? stationById.get(rj.stationId) : undefined;
      const matchesSearch =
        !term ||
        [rj.name, rj.slug, rj.email ?? "", rj.phone ?? "", station?.name ?? ""]
          .some((value) => value.toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && rj.isActive) ||
        (statusFilter === "inactive" && !rj.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [rjs, search, statusFilter, stationById]);

  const activeCount = rjs.filter((rj) => rj.isActive).length;
  const inactiveCount = rjs.length - activeCount;

  function openCreateForm() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  function openEditForm(rj: RJ) {
    setEditing(rj);
    setForm({
      name: rj.name,
      slug: rj.slug,
      email: rj.email ?? "",
      phone: rj.phone ?? "",
      photoUrl: rj.photoUrl ?? "",
      stationId: rj.stationId ?? "",
    });
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
  }

  function updateField(field: keyof RJForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveRJ(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setNotice("");

    const name = form.name.trim();
    const slug = slugify(form.slug);

    if (!name) {
      setFormError("Enter the RJ's name.");
      return;
    }
    if (!slug) {
      setFormError("Enter a valid URL slug, such as ananya-menon.");
      return;
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError("Enter a valid email address, or leave it blank.");
      return;
    }

    if (form.photoUrl.trim()) {
      try {
        const url = new URL(form.photoUrl.trim());
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          throw new Error("Invalid protocol");
        }
      } catch {
        setFormError("Photo URL must be a valid http:// or https:// URL.");
        return;
      }
    }

    const payload = {
      name,
      slug,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      photoUrl: form.photoUrl.trim() || null,
      stationId: form.stationId || null,
    };

    setSaving(true);

    try {
      const response = await fetch(
        editing ? `${API}/admin/rjs/${editing.id}` : `${API}/admin/rjs`,
        {
          method: editing ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        setFormError(await readError(response));
        return;
      }

      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setNotice(editing ? "RJ details updated successfully." : "RJ created successfully.");
      await loadData();
    } catch {
      setFormError("Could not connect to the backend. Check that it is running.");
    } finally {
      setSaving(false);
    }
  }

  async function setVerification(rj: RJ, verificationStatus: "verified" | "rejected") {
    const confirmed = window.confirm(
      verificationStatus === "verified"
        ? `Verify ${rj.name}? Their profile and programmes will become visible to listeners.`
        : `Reject ${rj.name}? Their profile and programmes stay hidden.`,
    );
    if (!confirmed) return;

    setChangingId(rj.id);
    setPageError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/admin/rjs/${rj.id}/verification`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus }),
      });

      if (!response.ok) {
        setPageError(await readError(response));
        setAccessDenied(response.status === 401 || response.status === 403);
        return;
      }

      setNotice(`${rj.name} has been ${verificationStatus === "verified" ? "verified" : "rejected"}.`);
      await loadData();
    } catch {
      setPageError("Could not connect to the backend. Check that it is running.");
    } finally {
      setChangingId(null);
    }
  }

  async function toggleActive(rj: RJ) {
    const action = rj.isActive ? "deactivate" : "activate";
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${rj.name}?`,
    );
    if (!confirmed) return;

    setChangingId(rj.id);
    setPageError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/admin/rjs/${rj.id}/active`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rj.isActive }),
      });

      if (!response.ok) {
        setPageError(await readError(response));
        setAccessDenied(response.status === 401 || response.status === 403);
        return;
      }

      setNotice(`${rj.name} has been ${rj.isActive ? "deactivated" : "activated"}.`);
      await loadData();
    } catch {
      setPageError("Could not connect to the backend. Check that it is running.");
    } finally {
      setChangingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#fffaf5] text-zinc-900">
      <header className="border-b border-orange-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3" aria-label="NowRJ home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white">
              <Radio size={22} />
            </span>
            <span>
              <span className="block text-lg font-black tracking-tight">NowRJ</span>
              <span className="block text-xs text-zinc-500">Superadmin</span>
            </span>
          </a>

          <div className="flex items-center gap-2">
          <a
            href="/admin/insights"
            className="inline-flex items-center gap-2 rounded-xl border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50"
          >
            Insights
          </a>
          <a
            href="/admin/stations"
            className="inline-flex items-center gap-2 rounded-xl border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50"
          >
            Stations &amp; claims
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back to site</span>
            <span className="sm:hidden">Back</span>
          </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">
              <ShieldCheck size={14} />
              ADMINISTRATION
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              RJ management
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 sm:text-base">
              Manage radio jockey profiles, station assignments and account status.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
          >
            <Plus size={18} />
            Add RJ
          </button>
        </div>

        {pageError && (
          <div
            role="alert"
            className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-start"
          >
            <AlertCircle className="mt-0.5 shrink-0" size={19} />
            <div className="flex-1">
              <p className="font-bold">
                {accessDenied ? "Superadmin access required" : "Something went wrong"}
              </p>
              <p className="mt-1">{pageError}</p>
              {accessDenied && (
                <a
                  href={`${API}/auth/google`}
                  className="mt-3 inline-flex rounded-lg bg-red-800 px-3 py-2 font-bold text-white hover:bg-red-900"
                >
                  Sign in with Google
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex items-center gap-2 self-start rounded-lg border border-red-200 px-3 py-2 font-semibold hover:bg-red-100"
            >
              <RefreshCw size={15} />
              Retry
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800"
          >
            <Check size={17} />
            {notice}
            <button
              type="button"
              onClick={() => setNotice("")}
              className="ml-auto rounded p-1 hover:bg-emerald-100"
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section aria-label="RJ statistics" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-600">Total RJs</span>
              <Users className="text-orange-500" size={20} />
            </div>
            <p className="mt-3 text-3xl font-black tabular-nums">
              {loading ? "—" : rjs.length}
            </p>
            <p className="mt-1 text-xs text-zinc-500">All registered profiles</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-600">Active</span>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
            <p className="mt-3 text-3xl font-black tabular-nums">
              {loading ? "—" : activeCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Available on public pages</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-600">Inactive</span>
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" />
            </div>
            <p className="mt-3 text-3xl font-black tabular-nums">
              {loading ? "—" : inactiveCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Hidden from public RJ listings</p>
          </div>
        </section>

        {formOpen && (
          <section
            aria-labelledby="rj-form-heading"
            className="mb-8 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
              <div>
                <h2 id="rj-form-heading" className="text-lg font-bold">
                  {editing ? "Edit RJ" : "Add a new RJ"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Fields marked with * are required.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close form"
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveRJ} className="space-y-5 p-5 sm:p-6">
              {formError && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">RJ name *</span>
                  <input
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    placeholder="e.g. Ananya Menon"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">URL slug *</span>
                  <input
                    required
                    maxLength={100}
                    value={form.slug}
                    onChange={(event) => updateField("slug", event.target.value)}
                    onBlur={() => updateField("slug", slugify(form.slug))}
                    placeholder="e.g. ananya-menon"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                  <span className="mt-1 block text-xs text-zinc-500">
                    Public profile: /rj/{slugify(form.slug) || "your-slug"}
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Phone</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    maxLength={30}
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    placeholder="Phone number"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold">Photo URL</span>
                  <input
                    type="url"
                    maxLength={2048}
                    value={form.photoUrl}
                    onChange={(event) => updateField("photoUrl", event.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold">Station assignment</span>
                  <div className="relative">
                    <select
                      value={form.stationId}
                      onChange={(event) => updateField("stationId", event.target.value)}
                      className="w-full appearance-none rounded-xl border border-zinc-300 bg-white px-3 py-3 pr-10 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    >
                      <option value="">No station assigned</option>
                      {stations.map((station) => (
                        <option key={station.id} value={station.id}>
                          {station.name}
                          {station.city ? ` — ${station.city}` : ""}
                          {!station.isActive ? " (Inactive)" : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" size={17} />
                  </div>
                  <span className="mt-1 block text-xs text-zinc-500">
                    You can leave this unassigned or select an existing station.
                  </span>
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-bold hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <LoaderCircle className="animate-spin" size={17} /> : <Check size={17} />}
                  {saving ? "Saving…" : editing ? "Save changes" : "Create RJ"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-zinc-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">Registered RJs</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {loading ? "Loading profiles…" : `${filteredRJs.length} of ${rjs.length} profiles`}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block flex-1">
                <span className="sr-only">Search RJs</span>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, slug, station…"
                  className="w-full rounded-xl border border-zinc-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 sm:w-64"
                />
              </label>

              <label className="block">
                <span className="sr-only">Filter by status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-500 sm:w-36"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                aria-label="Refresh RJ list"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 px-3 py-2.5 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>

          {loading && rjs.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 p-8 text-center">
              <LoaderCircle className="animate-spin text-orange-500" size={28} />
              <p className="text-sm text-zinc-600">Loading RJ profiles from the backend…</p>
            </div>
          ) : !pageError && filteredRJs.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                <UserRound size={24} />
              </span>
              <h3 className="font-bold">
                {rjs.length === 0 ? "No RJs registered yet" : "No matching RJs"}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-zinc-500">
                {rjs.length === 0
                  ? "Create the first RJ profile to get started."
                  : "Try another search term or change the status filter."}
              </p>
              {rjs.length === 0 && (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600"
                >
                  <Plus size={17} />
                  Add RJ
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">RJ</th>
                      <th className="px-5 py-3 font-semibold">Contact</th>
                      <th className="px-5 py-3 font-semibold">Station</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredRJs.map((rj) => {
                      const station = rj.stationId ? stationById.get(rj.stationId) : undefined;
                      return (
                        <tr key={rj.id} className="transition hover:bg-orange-50/40">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {rj.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={rj.photoUrl}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded-xl border border-zinc-200 object-cover"
                                />
                              ) : (
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 font-bold text-orange-700">
                                  {rj.name.trim().charAt(0).toUpperCase() || "R"}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="font-bold text-zinc-900">{rj.name}</p>
                                <p className="mt-0.5 text-xs text-zinc-500">/rj/{rj.slug}</p>
                                <VerificationNotes info={verificationInfo[rj.id]} />
                              </div>
                            </div>
                          </td>
                          <td className="max-w-56 px-5 py-4">
                            <p className="break-words text-zinc-700">{rj.email || "—"}</p>
                            <p className="mt-1 text-xs text-zinc-500">{rj.phone || "No phone"}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-zinc-700">{station?.name || "Unassigned"}</span>
                            {station && !station.isActive && (
                              <span className="ml-2 text-xs text-amber-700">Inactive station</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${rj.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${rj.isActive ? "bg-emerald-500" : "bg-zinc-400"}`} />
                              {rj.isActive ? "Active" : "Inactive"}
                            </span>
                            {needsReview(rj) && (
                              <span className="mt-1.5 flex w-fit items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                                {rj.verificationStatus === "rejected" ? "Rejected" : "Awaiting verification"}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditForm(rj)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold hover:border-orange-300 hover:bg-orange-50"
                              >
                                <Pencil size={14} />
                                Edit
                              </button>
                              {needsReview(rj) ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={changingId === rj.id}
                                    onClick={() => void setVerification(rj, "verified")}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                  >
                                    <ShieldCheck size={14} />
                                    {changingId === rj.id ? "Please wait…" : "Verify"}
                                  </button>
                                  {rj.verificationStatus !== "rejected" && (
                                    <button
                                      type="button"
                                      disabled={changingId === rj.id}
                                      onClick={() => void setVerification(rj, "rejected")}
                                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      Reject
                                    </button>
                                  )}
                                </>
                              ) : (
                              <button
                                type="button"
                                disabled={changingId === rj.id}
                                onClick={() => void toggleActive(rj)}
                                className={`rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50 ${rj.isActive ? "border-red-200 text-red-700 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}
                              >
                                {changingId === rj.id ? "Please wait…" : rj.isActive ? "Deactivate" : "Activate"}
                              </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-zinc-100 md:hidden">
                {filteredRJs.map((rj) => {
                  const station = rj.stationId ? stationById.get(rj.stationId) : undefined;
                  return (
                    <article key={rj.id} className="p-4">
                      <div className="flex items-start gap-3">
                        {rj.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={rj.photoUrl}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-xl border border-zinc-200 object-cover"
                          />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 font-bold text-orange-700">
                            {rj.name.trim().charAt(0).toUpperCase() || "R"}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold">{rj.name}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${rj.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                              {rj.isActive ? "Active" : "Inactive"}
                            </span>
                            {needsReview(rj) && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
                                {rj.verificationStatus === "rejected" ? "Rejected" : "Awaiting verification"}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 break-all text-xs text-zinc-500">/rj/{rj.slug}</p>
                          <VerificationNotes info={verificationInfo[rj.id]} />
                          <p className="mt-2 break-words text-sm text-zinc-700">{rj.email || "No email"}</p>
                          <p className="mt-1 text-sm text-zinc-600">{rj.phone || "No phone"}</p>
                          <p className="mt-1 text-sm text-zinc-600">
                            Station: {station?.name || "Unassigned"}
                            {station && !station.isActive ? " (Inactive)" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(rj)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-bold hover:bg-zinc-50"
                        >
                          <Pencil size={15} />
                          Edit
                        </button>
                        {needsReview(rj) ? (
                          <>
                            <button
                              type="button"
                              disabled={changingId === rj.id}
                              onClick={() => void setVerification(rj, "verified")}
                              className="flex-1 rounded-xl border border-emerald-200 px-3 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              {changingId === rj.id ? "Please wait…" : "Verify"}
                            </button>
                            {rj.verificationStatus !== "rejected" && (
                              <button
                                type="button"
                                disabled={changingId === rj.id}
                                onClick={() => void setVerification(rj, "rejected")}
                                className="flex-1 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            )}
                          </>
                        ) : (
                        <button
                          type="button"
                          disabled={changingId === rj.id}
                          onClick={() => void toggleActive(rj)}
                          className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold disabled:opacity-50 ${rj.isActive ? "border-red-200 text-red-700 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}
                        >
                          {changingId === rj.id ? "Please wait…" : rj.isActive ? "Deactivate" : "Activate"}
                        </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex flex-col gap-1 border-t border-zinc-100 bg-zinc-50/70 px-4 py-3 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span>Changes are saved to the NowRJ backend.</span>
            <span>Only authorised superadmins can manage RJ profiles.</span>
          </div>
        </section>
      </div>
    </main>
  );
}
