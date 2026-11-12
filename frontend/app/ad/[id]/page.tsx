"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Clock, Globe, LoaderCircle, MapPin, Phone } from "lucide-react";
import { API_URL } from "../../lib/config";
import { api, Notice } from "../../lib/ui";

type Ad = {
  id: string;
  kind: "sponsored" | "shoutout" | "aired";
  title: string;
  offerText: string;
  address: string | null;
  timings: string | null;
  phone: string | null;
  website: string | null;
  imageUrl: string | null;
  businessName: string;
  station: { name: string; slug: string };
  heardOn: string | null;
};

const LABEL = { sponsored: "Sponsored", shoutout: "RJ shout-out", aired: "Heard on air" } as const;

/** Records a Call or Visit website tap without holding up the listener. */
function respond(adId: string, kind: "call" | "website", showId: string | null) {
  try {
    void fetch(`${API_URL}/ads/${adId}/respond`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, showId }),
    });
  } catch {
    // Counting must never stop the call or the visit.
  }
}

function AdPage({ id }: { id: string }) {
  const showId = useSearchParams().get("show");
  const [ad, setAd] = useState<Ad | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Ad>(`/ads/${id}${showId ? `?show=${showId}` : ""}`).then(setAd).catch((e) => setError(e instanceof Error ? e.message : "This ad is not available."));
  }, [id, showId]);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">Now<span className="text-orange-600">RJ</span></Link>
        {error ? <Notice kind="error" text={error} /> : null}
        {!ad && !error ? <p className="mt-8 text-zinc-600"><LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />Loading…</p> : null}
        {ad ? (
          <article className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {ad.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${API_URL}${ad.imageUrl}`} alt="" className="aspect-[2/1] w-full object-cover" />
            ) : null}
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {LABEL[ad.kind]} · {ad.heardOn ? `${ad.heardOn}, ` : ""}
                <Link href={`/station/${ad.station.slug}`} className="hover:text-orange-700">{ad.station.name}</Link>
              </p>
              <p className="mt-2 text-sm font-semibold text-orange-700">{ad.businessName}</p>
              <h1 className="text-2xl font-bold text-zinc-900">{ad.title}</h1>
              <p className="mt-2 whitespace-pre-line text-zinc-700">{ad.offerText}</p>
              <div className="mt-4 space-y-1 text-sm text-zinc-600">
                {ad.address ? <p className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{ad.address}</p> : null}
                {ad.timings ? <p className="flex gap-2"><Clock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{ad.timings}</p> : null}
              </div>
              <div className="mt-5 grid gap-2">
                {ad.phone ? (
                  <a
                    href={`tel:${ad.phone.replace(/[^0-9+]/g, "")}`}
                    onClick={() => respond(ad.id, "call", showId)}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 font-semibold text-white hover:bg-orange-700"
                  >
                    <Phone size={18} aria-hidden="true" /> Call {ad.businessName}
                  </a>
                ) : null}
                {ad.website ? (
                  <a
                    href={ad.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    onClick={() => respond(ad.id, "website", showId)}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 font-semibold text-zinc-800 hover:bg-orange-50"
                  >
                    <Globe size={18} aria-hidden="true" /> Visit website
                  </a>
                ) : null}
              </div>
              {ad.phone ? <p className="mt-3 text-center text-xs text-zinc-500">Calls go directly to the business. NowRJ does not share your details.</p> : null}
            </div>
          </article>
        ) : null}
      </div>
    </main>
  );
}

export default function AdPageRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <AdPage id={id} />
    </Suspense>
  );
}
