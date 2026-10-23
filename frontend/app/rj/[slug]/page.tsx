import Link from "next/link";
import { Radio } from "lucide-react";
import FollowButton from "./FollowButton";
import { Avatar, fetchPage, fetchShows, NotFound, PageFrame, ProgrammeRow, ShowsNow, type ProgrammeSummary } from "../../lib/public-pages";

export const instant = false;

type RjPage = {
  id: string;
  name: string;
  slug: string;
  photoUrl: string | null;
  station: { name: string; slug: string } | null;
  programmes: ProgrammeSummary[];
};

export default async function RjProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rj = await fetchPage<RjPage>(`/pages/rj/${encodeURIComponent(slug)}`);
  if (!rj) return <NotFound what="RJ profile" />;
  const shows = await fetchShows((show) => show.hosts.some((host) => host.id === rj.id));

  return (
    <PageFrame>
      <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar name={rj.name} photoUrl={rj.photoUrl} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">Radio jockey</p>
            <h1 className="mt-1 text-3xl font-extrabold text-zinc-900">RJ {rj.name}</h1>
            {rj.station ? (
              <Link
                href={`/station/${rj.station.slug}`}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100"
              >
                <Radio size={17} aria-hidden="true" />
                {rj.station.name}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="mt-6 border-t border-zinc-100 pt-5">
          <FollowButton rjId={rj.id} />
        </div>
      </section>

      <ShowsNow shows={shows} empty={`RJ ${rj.name} has no show in the next 24 hours. See the weekly schedule below.`} />

      <section className="mt-8 pb-8">
        <h2 className="text-xl font-bold text-zinc-900">Programmes</h2>
        {rj.programmes.length ? (
          <div className="mt-4 flex flex-col gap-3">
            {rj.programmes.map((programme) => <ProgrammeRow key={programme.id} programme={programme} />)}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-600">No programmes published yet.</p>
        )}
      </section>
    </PageFrame>
  );
}
