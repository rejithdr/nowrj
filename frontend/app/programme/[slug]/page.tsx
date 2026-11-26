import Link from "next/link";
import ReportButton from "../../ReportButton";
import { Clock, Phone, Radio } from "lucide-react";
import { Avatar, fetchPage, fetchShows, NotFound, PageFrame, StationLabel, ShowsNow, type ProgrammeSummary } from "../../lib/public-pages";
import { GuestCard, type GuestSession } from "../../lib/guest-card";
import TakePart from "../../lib/take-part";
import PrivateComment from "../../lib/private-comment";
import type { Metadata } from "next";
import ShareButton from "../../lib/share-button";

export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await fetchPage<ProgrammeSummary>(`/pages/programme/${encodeURIComponent(slug)}`);
  if (!p) return { title: "Programme · NowRJ" };
  const who = [p.hosts.map((h) => h.name).join(", "), p.station?.name ?? p.invitedStationName].filter(Boolean).join(" · ");
  const description = `${who ? `${who}. ` : ""}${p.scheduleText ? `${p.scheduleText}. ` : ""}Request songs, react live and call the show on NowRJ.`;
  return { title: `${p.name} · NowRJ`, description, openGraph: { title: p.name, description, url: `/programme/${p.slug}`, siteName: "NowRJ", type: "website" } };
}

type ProgrammePage = ProgrammeSummary & { callInPhone: string | null; location: string | null };

export default async function ProgrammePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const programme = await fetchPage<ProgrammePage>(`/pages/programme/${encodeURIComponent(slug)}`);
  if (!programme) return <NotFound what="Programme" />;
  const shows = await fetchShows((show) => show.programme.slug === programme.slug);
  const guests = ((await fetchPage<GuestSession[]>("/guest-sessions/open")) ?? []).filter((g) => g.programme.slug === programme.slug);

  return (
    <PageFrame>
      <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">Programme</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">{programme.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ShareButton
            path={`/programme/${programme.slug}`}
            programmeId={programme.id}
            text={`Listen to ${programme.name}${programme.hosts.length ? ` with ${programme.hosts.map((h) => h.name).join(", ")}` : ""}${programme.station ? ` on ${programme.station.name}` : ""}. Request songs and call in on NowRJ:`}
          />
          <ReportButton targetType="programme" targetId={programme.id} label="Report this programme" />
        </div>

        <dl className="mt-6 space-y-4 border-t border-zinc-100 pt-5">
          {programme.hosts.length ? (
            <div>
              <dt className="text-sm text-zinc-500">{programme.hosts.length > 1 ? "Hosts" : "Host"}</dt>
              <dd className="mt-2 flex flex-wrap gap-3">
                {programme.hosts.map((rj) => (
                  <Link key={rj.id} href={`/rj/${rj.slug}`} className="inline-flex items-center gap-2 rounded-full pr-3 font-semibold text-zinc-900 hover:bg-orange-50 hover:text-orange-700">
                    <Avatar name={rj.name} photoUrl={rj.photoUrl} size="md" />
                    RJ {rj.name}
                  </Link>
                ))}
              </dd>
            </div>
          ) : null}
          <div className="flex items-start gap-3">
            <Radio size={20} className="mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
            <div>
              <dt className="text-sm text-zinc-500">Station</dt>
              <dd className="font-semibold text-zinc-900"><StationLabel programme={programme} /></dd>
              {programme.location ? <dd className="text-sm text-zinc-500">{programme.location}</dd> : null}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock size={20} className="mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
            <div>
              <dt className="text-sm text-zinc-500">Every week</dt>
              <dd className="font-semibold text-zinc-900">{programme.scheduleText ?? "Schedule not set"}</dd>
            </div>
          </div>
          {programme.callInPhone ? (
            <div className="flex items-start gap-3">
              <Phone size={20} className="mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
              <div>
                <dt className="text-sm text-zinc-500">Call-in number (during the show)</dt>
                <dd className="font-semibold text-zinc-900">{programme.callInPhone}</dd>
              </div>
            </div>
          ) : null}
        </dl>
      </section>

      <TakePart programmeId={programme.id} programmeName={programme.name} />

      {guests.length ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold text-zinc-900">Ask the guest</h2>
          <div className="mt-4 flex flex-col gap-3">
            {guests.map((guest) => <GuestCard key={guest.id} guest={guest} />)}
          </div>
        </section>
      ) : null}

      <PrivateComment programmeId={programme.id} />

      <div className="pb-8">
        <ShowsNow shows={shows} empty="No show in the next 24 hours. Check the weekly schedule above." />
      </div>
    </PageFrame>
  );
}
