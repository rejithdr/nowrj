import { SERVER_API_URL } from "../../lib/config";

import Link from "next/link";
import { ArrowLeft, Radio, MapPin } from "lucide-react";
import AuthControls from "../../AuthControls";

export const instant = false;

const stations = {
  "radio-mango": {
    name: "Radio Mango",
    location: "Kerala",
    description:
      "Discover programmes, music and conversations from Radio Mango.",
    programmes: [
      {
        id: "morning-vibes",
        title: "Morning Vibes",
        rj: "Ananya",
        rjSlug: "ananya",
        time: "Live now",
      },
      {
        id: "good-morning",
        title: "Good Morning Kerala",
        rj: "Ananya",
        rjSlug: "ananya",
        time: "Aired earlier",
      },
    ],
  },
  "club-fm": {
    name: "Club FM",
    location: "Kerala",
    description:
      "Explore music, entertainment and radio programmes from Club FM.",
    programmes: [
      {
        id: "drive-time",
        title: "Drive Time",
        rj: "Arjun",
        rjSlug: "arjun",
        time: "Live now",
      },
      {
        id: "night-beats",
        title: "Night Beats",
        rj: "Nikhil",
        rjSlug: "nikhil",
        time: "8:00 PM",
      },
    ],
  },
  "red-fm": {
    name: "Red FM",
    location: "Kerala",
    description:
      "Explore music and entertainment from Red FM.",
    programmes: [
      {
        id: "music-mix",
        title: "Music Mix",
        rj: "Meera",
        rjSlug: "meera",
        time: "Live now",
      },
    ],
  },
  "radio-city": {
    name: "Radio City",
    location: "Kerala",
    description:
      "Discover shows and radio entertainment from Radio City.",
    programmes: [
      {
        id: "evening-show",
        title: "The Evening Show",
        rj: "Rahul",
        rjSlug: "rahul",
        time: "Live now",
      },
    ],
  },
};

export default async function StationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {

  const { slug } = await params;
  let station = stations[slug as keyof typeof stations];

  if (!station) {
    try {
      const response = await fetch(`${SERVER_API_URL}/stations`, {
        cache: "no-store",
      });

      if (response.ok) {
const databaseStations: {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  isActive: boolean;
}[] = await response.json();


        const databaseStation = databaseStations.find(
          (item) => item.slug === slug && item.isActive,
        );

        if (databaseStation) {
          const programmeResponse = await fetch(
            `${SERVER_API_URL}/programmes/station/${databaseStation.id}`,
            { cache: "no-store" },
          );

          type ApiProgramme = {
            id: string;
            name: string;
            slug: string;
            rjName: string | null;
            startTime: string | null;
            endTime: string | null;
            scheduleText?: string | null;
          };

          const databaseProgrammes: ApiProgramme[] =
            programmeResponse.ok ? await programmeResponse.json() : [];

            const rjResponse = await fetch(`${SERVER_API_URL}/rjs`);
const databaseRjs = rjResponse.ok ? await rjResponse.json() : [];
          station = {
            name: databaseStation.name,
            location:
              [databaseStation.city, databaseStation.state]
                .filter(Boolean)
                .join(", ") || "Location not specified",
            description: `Discover programmes and radio updates from ${databaseStation.name}.`,
            programmes: databaseProgrammes.map((programme) => ({
              id: programme.slug,
              title: programme.name,
              rj: programme.rjName || "RJ details unavailable",
              rjSlug:
  databaseRjs.find(
    (rj: { name: string }) =>
      rj.name.toLowerCase() === programme.rjName?.toLowerCase(),
  )?.slug ?? "",
              time:
                programme.scheduleText ||
                (programme.startTime && programme.endTime
                  ? `${programme.startTime.slice(0, 5)}–${programme.endTime.slice(0, 5)}`
                  : "Time not specified"),
            })),
          };
        }

      }
    } catch {
      // Keep the existing "Station not found" behaviour if the API is unavailable.
    }
  }


  if (!station) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to programmes
          </Link>

          <h1 className="mt-8 text-2xl font-bold text-zinc-900">
            Station not found
          </h1>

          <p className="mt-2 text-zinc-600">
            This station is not available in the preview.
          </p>
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
          <span className="text-right text-xs font-medium text-zinc-500 sm:text-sm">
            Beyond the broadcast
          </span>
        </header>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-orange-700"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to programmes
        </Link>

        <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">
            Station details
          </p>

          <div className="mt-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
            <Radio size={32} aria-hidden="true" />
          </div>

          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
            {station.name}
          </h1>

          <p className="mt-3 text-base leading-7 text-zinc-600">
            {station.description}
          </p>

          <p className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-500">
            <MapPin size={16} aria-hidden="true" />
            {station.location}
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold text-zinc-900">
            Programmes
          </h2>

          <p className="mt-1 text-sm text-zinc-600">
            Explore programmes associated with this station.
          </p>

          <div className="mt-4 space-y-3">
            {station.programmes.map((programme) => (
              <article
                key={programme.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <p className="text-xs font-semibold text-orange-700">
                  {programme.time}
                </p>

                <h3 className="mt-2 font-bold text-zinc-900">
                  <Link
                    href={`/programme/${programme.id}`}
                    className="hover:text-orange-700"
                  >
                    {programme.title}
                  </Link>
                </h3>

                <p className="mt-1 text-sm text-zinc-600">
                  Your radio jockey
                </p>

                <Link
                  href={`/rj/${programme.rjSlug}`}
                  className="mt-1 inline-block text-sm font-semibold text-zinc-900 hover:text-orange-700"
                >
                  RJ {programme.rj}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <footer className="py-8 text-center text-sm text-zinc-500">
          NowRJ · Beyond the broadcast
        </footer>
      </div>
    </main>
  );
}