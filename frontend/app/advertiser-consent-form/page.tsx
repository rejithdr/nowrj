"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { api, primaryButton } from "../lib/ui";

/** A printable consent form a station can get signed, scan and upload. */
export default function ConsentFormPage() {
  const [consent, setConsent] = useState<{ version: string; points: string[] } | null>(null);
  useEffect(() => {
    api<{ version: string; points: string[] }>("/advertiser-consent").then(setConsent).catch(() => undefined);
  }, []);
  const line = "border-b border-zinc-400 min-h-8";
  return (
    <main className="mx-auto max-w-2xl bg-white px-6 py-8 text-zinc-900 print:px-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-extrabold">Now<span className="text-orange-600">RJ</span></p>
          <h1 className="mt-2 text-xl font-bold">Consent to advertise on NowRJ</h1>
          <p className="text-sm text-zinc-600">Now On FM · nowonfmindia@gmail.com</p>
        </div>
        <button type="button" onClick={() => window.print()} className={`${primaryButton} print:hidden`}>
          <Printer size={16} aria-hidden="true" /> Print
        </button>
      </div>
      <div className="mt-6 grid gap-4 text-sm">
        <div><p className="font-semibold">Business name</p><div className={line} /></div>
        <div><p className="font-semibold">Address</p><div className={line} /></div>
        <div><p className="font-semibold">Radio station</p><div className={line} /></div>
      </div>
      <p className="mt-6 text-sm font-semibold">The business agrees that:</p>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">{(consent?.points ?? []).map((p) => <li key={p}>{p}</li>)}</ol>
      <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
        <div><p className="font-semibold">Name of person signing</p><div className={line} /></div>
        <div><p className="font-semibold">Designation</p><div className={line} /></div>
        <div><p className="font-semibold">Signature and business seal</p><div className={`${line} min-h-16`} /></div>
        <div><p className="font-semibold">Date</p><div className={line} /></div>
      </div>
      <p className="mt-8 text-xs text-zinc-500">Form version {consent?.version ?? ""}. The station uploads a scan of this signed form to NowRJ; the NowRJ team checks it before any ad runs.</p>
    </main>
  );
}
