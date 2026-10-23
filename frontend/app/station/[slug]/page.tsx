import { MapPin, Radio } from "lucide-react";
import { fetchPage, fetchShows, NotFound, PageFrame, ProgrammeRow, ShowsNow, type ProgrammeSummary } from "../../lib/public-pages";

export const instant = false;

type StationPage = { id: string; name: string; slug: string; location: string | null; programmes: ProgrammeSummary[] };

export default async function StationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const station = await fetchPage<StationPage>(`/pages/station/${encodeURIComponent(slug)}`);
  if (!station) return <NotFound what="Station" />;
  const shows = await fetchShows((show) => show.station?.slug === station.slug);

  return (
    <PageFrame>
      <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
          <Radio size={32} aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-widest text-orange-600">Radio station</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">{station.name}</h1>
        {station.location ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-zinc-500">
            <MapPin size={16} aria-hidden="true" />
            {station.location}
          </p>
        ) : null}
      </section>

      <ShowsNow shows={shows} empty={`No ${station.name} shows on NowRJ in the next 24 hours.`} />

      <section className="mt-8 pb-8">
        <h2 className="text-xl font-bold text-zinc-900">Programmes</h2>
        {station.programmes.length ? (
          <div className="mt-4 flex flex-col gap-3">
            {station.programmes.map((programme) => <ProgrammeRow key={programme.id} programme={programme} />)}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-600">No programmes on NowRJ yet.</p>
        )}
      </section>
    </PageFrame>
  );
}
