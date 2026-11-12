"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import AuthControls from "../../AuthControls";
import { API_URL } from "../../lib/config";
import { api, Card, Notice, primaryButton, quietButton, StatusPill } from "../../lib/ui";

type StationRow = { id: string; name: string; city: string | null; adsEnabled: boolean; organisationName: string | null; organisationKind: string | null; advertisers: number };
type Scan = { id: string; createdAt: string; businessName: string; contactName: string; email: string; stationName: string | null; uploadedBy: string | null };

/** Super Admin: the ads switch for each station, and scanned consents to check. */
export default function AdminAdsPage() {
  const [stations, setStations] = useState<StationRow[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([api<StationRow[]>("/admin/ads/stations"), api<Scan[]>("/admin/ads/consents")]);
    setStations(s);
    setScans(c);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Could not load."));
  }, [load]);

  async function act(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(done);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 hover:underline"><ArrowLeft size={16} aria-hidden="true" /> Back to NowRJ</Link>
          <AuthControls />
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-orange-700">Super Admin</p>
        <h1 className="text-2xl font-bold text-zinc-900">Ads</h1>
        {message ? <Notice kind="ok" text={message} /> : null}
        {error ? <Notice kind="error" text={error} /> : null}

        {scans.length ? (
          <Card title="Signed consent forms to check">
            <ul className="mt-2 divide-y divide-zinc-100">
              {scans.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900">{s.businessName}</p>
                    <p className="text-sm text-zinc-600">{s.contactName} · {s.email}</p>
                    <p className="text-xs text-zinc-500">Uploaded by {s.uploadedBy ?? "—"}{s.stationName ? ` at ${s.stationName}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={`${API_URL}/admin/ads/consents/${s.id}/scan`} target="_blank" rel="noreferrer" className={quietButton}><ExternalLink size={14} aria-hidden="true" /> Open scan</a>
                    <button type="button" disabled={busy} className={primaryButton} onClick={() => void act(() => api(`/admin/ads/consents/${s.id}/approve`, { method: "POST" }), `Consent for ${s.businessName} accepted.`)}>Accept</button>
                    <button
                      type="button"
                      disabled={busy}
                      className={quietButton}
                      onClick={() => {
                        const note = window.prompt("What is wrong with the scan? The station will see this.");
                        if (note) void act(() => api(`/admin/ads/consents/${s.id}/reject`, { method: "POST", body: JSON.stringify({ note }) }), "Scan not accepted.");
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card title="Ads switch per station">
          <p className="text-sm text-zinc-600">Ads stay off until you switch them on. A station with ads off sees no advertiser menu.</p>
          <ul className="mt-2 divide-y divide-zinc-100">
            {stations.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold text-zinc-900">{s.name}{s.city ? ` · ${s.city}` : ""}</p>
                  <p className="text-sm text-zinc-600">{s.organisationKind === "network" ? `${s.organisationName} · ` : ""}{s.advertisers} advertiser{s.advertisers === 1 ? "" : "s"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill text={s.adsEnabled ? "Ads on" : "Ads off"} tone={s.adsEnabled ? "green" : "zinc"} />
                  <button
                    type="button"
                    disabled={busy}
                    className={s.adsEnabled ? quietButton : primaryButton}
                    onClick={() => void act(() => api(`/admin/ads/stations/${s.id}`, { method: "POST", body: JSON.stringify({ enabled: !s.adsEnabled }) }), `Ads ${s.adsEnabled ? "off" : "on"} for ${s.name}.`)}
                  >
                    {s.adsEnabled ? "Turn off" : "Turn on"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
