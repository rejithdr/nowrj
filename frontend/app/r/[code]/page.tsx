"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Mic, Radio } from "lucide-react";
import { api, Card, Notice, primaryButton, quietButton } from "../../lib/ui";
import { saveReferral } from "../../lib/referral";

type Lookup = { code: string; rjName: string; rjSlug: string; photoUrl: string | null };

/** Landing page for an RJ's referral link. */
export default function ReferralLanding({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [rj, setRj] = useState<Lookup | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Lookup>(`/referrals/code/${encodeURIComponent(code)}`)
      .then((data) => {
        setRj(data);
        saveReferral(data.code);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "This link is not valid."));
  }, [code]);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">
          Now<span className="text-orange-600">RJ</span>
        </Link>
        {error ? <Notice kind="error" text={error} /> : null}
        {!rj && !error ? (
          <p className="mt-8 text-zinc-600">
            <LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />
            Loading…
          </p>
        ) : null}
        {rj ? (
          <Card>
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xl font-bold text-orange-700">
                {rj.rjName.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">Invitation</p>
                <h1 className="text-2xl font-bold text-zinc-900">{rj.rjName} invited you to NowRJ</h1>
              </div>
            </div>
            <p className="mt-4 text-zinc-700">
              Follow {rj.rjName}, react while the show is live, request songs and call in, all in one place.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href={`/rj/${rj.rjSlug}`} className={primaryButton}>
                <Radio size={16} aria-hidden="true" />
                See {rj.rjName}&apos;s profile
              </Link>
              <Link href="/rj/register" className={quietButton}>
                <Mic size={14} aria-hidden="true" />
                I&apos;m an RJ too
              </Link>
            </div>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
