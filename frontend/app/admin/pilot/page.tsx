"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthControls from "../../AuthControls";
import PilotNumbers from "../../lib/pilot-numbers";
import { api, Card } from "../../lib/ui";

/** Super Admin: pilot numbers for all of NowRJ, or one station. */
export default function PilotPage() {
  const [stations, setStations] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api<{ id: string; name: string }[]>("/admin/ads/stations")
      .then((list) => setStations(list.map((s) => ({ id: s.id, name: s.name }))))
      .catch(() => setStations([]));
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">Now<span className="text-orange-600">RJ</span></Link>
          <AuthControls />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-zinc-900">Pilot numbers</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Counted per phone (or per signed-in listener without one), once a day per step. No names. Stations see their own numbers on their dashboard.
        </p>
        <Card>
          <PilotNumbers path="/admin/pilot" stations={stations} />
        </Card>
      </div>
    </main>
  );
}
