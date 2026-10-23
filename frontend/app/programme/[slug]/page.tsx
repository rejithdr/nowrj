import Link from "next/link";
import { Clock, Phone, Radio } from "lucide-react";
import { Avatar, fetchPage, fetchShows, NotFound, PageFrame, StationLabel, ShowsNow, type ProgrammeSummary } from "../../lib/public-pages";

export const instant = false;

type ProgrammePage = ProgrammeSummary & { callInPhone: string | null; location: string | null };

export default async function ProgrammePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const programme = await fetchPage<ProgrammePage>(`/pages/programme/${encodeURIComponent(slug)}`);
  if (!programme) return <NotFound what="Programme" />;
  const shows = await fetchShows((show) => show.programme.slug === programme.slug);

  return (
    <PageFrame>
      <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">Programme</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">{programme.name}</h1>

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

      <div className="pb-8">
        <ShowsNow shows={shows} empty="No show in the next 24 hours. Check the weekly schedule above." />
      </div>
    </PageFrame>
  );
}
