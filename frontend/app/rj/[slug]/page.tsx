
import Link from "next/link";
import { ArrowLeft, Radio, Clock } from "lucide-react";
import FollowButton from "./FollowButton";
import LikeButton from "./LikeButton";
import FireButton from "./FireButton";
import AuthControls from "../../AuthControls";

export const instant = false;

const rjProfiles = {
  ananya: {
    name: "Ananya",
    station: "Radio Mango",
    stationSlug: "radio-mango",
    programme: "Morning Vibes",
    programmeSlug: "morning-vibes",
    schedule: "Morning show",
    description:
      "Bringing music, stories and listeners together every morning.",
  },
  arjun: {
    name: "Arjun",
    station: "Club FM",
    stationSlug: "club-fm",
    programme: "Drive Time",
    programmeSlug: "drive-time",
    schedule: "Drive-time show",
    description:
      "Making your journey more enjoyable with music and conversations.",
  },
  meera: {
    name: "Meera",
    station: "Red FM",
    stationSlug: "red-fm",
    programme: "Music Mix",
    programmeSlug: "music-mix",
    schedule: "Music show",
    description:
      "Bringing listeners together through music and entertainment.",
  },
  rahul: {
    name: "Rahul",
    station: "Radio City",
    stationSlug: "radio-city",
    programme: "The Evening Show",
    programmeSlug: "evening-show",
    schedule: "Evening show",
    description:
      "Your companion for music and conversations in the evening.",
  },
  nikhil: {
    name: "Nikhil",
    station: "Club FM",
    stationSlug: "club-fm",
    programme: "Night Beats",
    programmeSlug: "night-beats",
    schedule: "Night show",
    description:
      "Music and entertainment to accompany your night.",
  },
};

export default async function RJProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
 const { slug } = await params;
  let profile: {
    id?: string;
    name: string;
    station: string;
    stationSlug: string;
    programme: string;
    programmeSlug: string;
    schedule: string;
    description: string;
  } | undefined = rjProfiles[slug as keyof typeof rjProfiles];

  if (!profile) {
  try {
    const response = await fetch(
      `http://localhost:3000/rjs/${slug}`,
    );

    if (response.ok) {
      const rj = await response.json();

      const stationsResponse = await fetch(
        'http://localhost:3000/stations',
      );
      const stations = stationsResponse.ok
        ? await stationsResponse.json()
        : [];

      const station = stations.find(
        (item: { id: string }) => item.id === rj.stationId,
      );
const programmeResponse = await fetch(
  'http://localhost:3000/programmes',
);
const programmes = programmeResponse.ok
  ? await programmeResponse.json()
  : [];

const programme = programmes.find(
  (item: { rjName?: string; stationId: string }) =>
    item.rjName?.toLowerCase() === rj.name.toLowerCase() &&
    item.stationId === rj.stationId,
);
      profile = {
        id: rj.id,
        name: rj.name,
        station: station?.name ?? 'Station details unavailable',
        stationSlug: station?.slug ?? '',
        programme: programme?.name ?? '',
programmeSlug: programme?.slug ?? '',
schedule: programme
  ? programme.scheduleText ||
    [programme.startTime, programme.endTime]
      .filter(Boolean)
      .join('–') || 'Schedule not specified'
  : '',
        description: 'Radio jockey on NowRJ.',
      };
    }
  } catch {
    // Keep the existing not-found page if the API is unavailable.
  }
}

  if (!profile) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 hover:underline focus-visible:outline-2 focus-visible:outline-orange-600"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to programmes
          </Link>

          <h1 className="mt-8 text-2xl font-bold text-zinc-900">
            RJ profile not found
          </h1>

          <p className="mt-2 text-zinc-600">
            This RJ profile is not available in the preview.
          </p>

          <Link
            href="/"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
          >
            Explore programmes
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-2xl font-extrabold tracking-tight text-zinc-900"
          >
            Now<span className="text-orange-600">RJ</span>
          </Link>
          <AuthControls />
          <span className="text-right text-xs text-zinc-500 sm:text-sm">
            Beyond the broadcast
          </span>
        </header>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-orange-700 hover:underline focus-visible:outline-2 focus-visible:outline-orange-600"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to programmes
        </Link>

        <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-orange-100 text-4xl font-bold text-orange-700"
              aria-label={`Profile placeholder for RJ ${profile.name}`}
            >
              {profile.name.charAt(0)}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">
                Radio jockey
              </p>

              <h1 className="mt-1 text-3xl font-extrabold text-zinc-900">
                RJ {profile.name}
              </h1>

              <Link
                href={`/station/${profile.stationSlug}`}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
              >
                <Radio size={17} aria-hidden="true" />
                {profile.station}
                <span aria-hidden="true">→</span>
              </Link>

              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {profile.description}
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-zinc-100 pt-5">
            <FollowButton rjId={profile.id} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold text-zinc-900">
            Programme
          </h2>

          <article className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700">
              <Clock size={16} aria-hidden="true" />
              Sample schedule
            </p>

            <Link
              href={`/programme/${profile.programmeSlug}`}
              className="mt-3 flex min-h-14 items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-left font-bold text-zinc-900 hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
            >
              <span>{profile.programme}</span>
              <span className="shrink-0 text-orange-700" aria-hidden="true">
                →
              </span>
            </Link>

            <p className="mt-3 text-sm text-zinc-600">
              {profile.station} · {profile.schedule}
            </p>

            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Exact broadcast timings will be added when schedules are connected.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <LikeButton rjId={profile.id} />
              <FireButton rjId={profile.id} />
            </div>
          </article>
        </section>

        <footer className="py-8 text-center text-sm text-zinc-500">
          NowRJ · Beyond the broadcast
        </footer>
      </div>
    </main>
  );
}