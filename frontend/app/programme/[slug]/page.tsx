
import Link from "next/link";
import { ArrowLeft, Radio, Clock } from "lucide-react";

export const instant = false;

const programmes = {
  "morning-vibes": {
    title: "Morning Vibes",
    rj: "Ananya",
    rjSlug: "ananya",
    station: "Radio Mango",
    stationSlug: "radio-mango",
    location: "Kerala",
    schedule: "Morning show",
    time: "Sample schedule",
    description:
      "Start your day with music, stories and conversations. Join Ananya for a refreshing mix of entertainment and listener connection.",
  },
  "drive-time": {
    title: "Drive Time",
    rj: "Arjun",
    rjSlug: "arjun",
    station: "Club FM",
    stationSlug: "club-fm",
    location: "Kerala",
    schedule: "Drive-time show",
    time: "Sample schedule",
    description:
      "Make your journey more enjoyable with music, entertainment and conversations from the world of radio.",
  },
  "music-mix": {
    title: "Music Mix",
    rj: "Meera",
    rjSlug: "meera",
    station: "Red FM",
    stationSlug: "red-fm",
    location: "Kerala",
    schedule: "Music show",
    time: "Sample schedule",
    description:
      "Discover music and entertainment with Meera on Music Mix.",
  },
  "evening-show": {
    title: "The Evening Show",
    rj: "Rahul",
    rjSlug: "rahul",
    station: "Radio City",
    stationSlug: "radio-city",
    location: "Kerala",
    schedule: "Evening show",
    time: "Sample schedule",
    description:
      "Enjoy music and conversations with Rahul on The Evening Show.",
  },
  "night-beats": {
    title: "Night Beats",
    rj: "Nikhil",
    rjSlug: "nikhil",
    station: "Club FM",
    stationSlug: "club-fm",
    location: "Kerala",
    schedule: "Night show",
    time: "Sample schedule",
    description:
      "Wind down with music and entertainment from Nikhil on Night Beats.",
  },
  "good-morning": {
    title: "Good Morning Kerala",
    rj: "Ananya",
    rjSlug: "ananya",
    station: "Radio Mango",
    stationSlug: "radio-mango",
    location: "Kerala",
    schedule: "Morning show",
    time: "Sample schedule",
    description:
      "Start the morning with music and stories for listeners across Kerala.",
  },
};

export default async function ProgrammePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const programme = programmes[slug as keyof typeof programmes];

  if (!programme) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 focus-visible:outline-2 focus-visible:outline-orange-600"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to programmes
          </Link>

          <h1 className="mt-8 text-2xl font-bold text-zinc-900">
            Programme not found
          </h1>

          <p className="mt-2 text-zinc-600">
            This programme is not available in the preview.
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

          <span className="text-right text-xs font-medium text-zinc-500 sm:text-sm">
            Beyond the broadcast
          </span>
        </header>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-orange-600"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to programmes
        </Link>

        <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">
            Programme details
          </p>

          <p className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
            <Radio size={16} aria-hidden="true" />
            {programme.time}
          </p>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
            {programme.title}
          </h1>

          <p className="mt-3 text-base leading-7 text-zinc-600">
            {programme.description}
          </p>

          <div className="mt-6 space-y-5 border-t border-zinc-100 pt-5">
            <div className="flex items-start gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700"
                aria-hidden="true"
              >
                {programme.rj.charAt(0)}
              </div>

              <div>
                <p className="text-sm text-zinc-500">Your radio jockey</p>
                <Link
                  href={`/rj/${programme.rjSlug}`}
                  className="mt-1 inline-flex min-h-11 items-center font-bold text-zinc-900 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-orange-600"
                >
                  RJ {programme.rj} →
                </Link>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Radio
                size={20}
                className="mt-2 shrink-0 text-orange-600"
                aria-hidden="true"
              />

              <div>
                <p className="text-sm text-zinc-500">Station</p>
                <Link
                  href={`/station/${programme.stationSlug}`}
                  className="mt-1 inline-flex min-h-11 items-center rounded-full border border-orange-200 bg-orange-50 px-4 py-2 font-semibold text-orange-800 hover:bg-orange-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
                >
                  {programme.station} →
                </Link>
                <p className="text-sm text-zinc-500">{programme.location}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock
                size={20}
                className="mt-2 shrink-0 text-orange-600"
                aria-hidden="true"
              />

              <div>
                <p className="text-sm text-zinc-500">Programme schedule</p>
                <p className="font-semibold text-zinc-900">
                  {programme.schedule}
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Sample information only. Actual broadcast timings will be
                  added when schedules are connected.
                </p>
              </div>
            </div>
          </div>

          <Link
            href={`/rj/${programme.rjSlug}`}
            className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
          >
            View RJ profile
          </Link>
        </section>

        <footer className="py-8 text-center text-sm text-zinc-500">
          NowRJ · Beyond the broadcast
        </footer>
      </div>
    </main>
  );
}