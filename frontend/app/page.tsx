
import Link from "next/link";
import LikeButton from "./rj/[slug]/LikeButton";
import FireButton from "./rj/[slug]/FireButton";
import { Mic, Phone } from "lucide-react";
type Programme = {
  id: string;
  title: string;
  rj: string;
  station: string;
  time: string;
  initials: string;
  contactNumber: string;
};

const followedProgrammes: Programme[] = [
  {
    id: "morning-vibes",
    title: "Morning Vibes",
    rj: "Ananya",
    station: "Radio Mango",
    time: "Live now",
    initials: "A",
     contactNumber: "8139005150",
  },
  {
    id: "drive-time",
    title: "Drive Time",
    rj: "Arjun",
    station: "Club FM",
    time: "Live now",
    initials: "A",
     contactNumber: "8139005150",
  },
];

const otherLiveProgrammes: Programme[] = [
  {
    id: "music-mix",
    title: "Music Mix",
    rj: "Meera",
    station: "Red FM",
    time: "Live now",
    initials: "M",
     contactNumber: "8139005150",
  },
  {
    id: "evening-show",
    title: "The Evening Show",
    rj: "Rahul",
    station: "Radio City",
    time: "Live now",
    initials: "R",
     contactNumber: "8139005150",
  },
];

const upcomingProgrammes: Programme[] = [
  {
    id: "night-beats",
    title: "Night Beats",
    rj: "Nikhil",
    station: "Club FM",
    time: "8:00 PM",
    initials: "N",
     contactNumber: "8139005150",
  },
];

const previousProgrammes: Programme[] = [
  {
    id: "good-morning",
    title: "Good Morning Kerala",
    rj: "Ananya",
    station: "Radio Mango",
    time: "Aired earlier",
    initials: "A",
     contactNumber: "8139005150",
  },
];

function ProgrammeCard({ programme }: { programme: Programme }) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">
          {programme.initials}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-zinc-900">
            <Link
               href={`/programme/${programme.id}`}
            className="hover:text-orange-700"
            >
          {programme.title}
          </Link>
          </h3>
          
<p className="mt-1 text-sm text-zinc-600">
  RJ {programme.rj} ·{" "}
  <Link
    href={`/station/${programme.station
      .toLowerCase()
      .replace(/\s+/g, "-")}`}
    className="hover:text-orange-700"
  >
    {programme.station}
  </Link>
</p>
          <p className="mt-1 text-xs font-semibold text-orange-700">
            {programme.time}
          </p>
        </div>
      </div>

<div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
  <LikeButton />
  <FireButton />
    <a
    href={`tel:${programme.contactNumber}`}
    className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
  >
    <Mic size={16} aria-hidden="true" />
    <Phone size={16} aria-hidden="true" />
    Call RJ
  </a>
      </div>
    </article>
  );
}

export default function Home() {
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

  <div className="flex items-center gap-3">
    <Link
      href="/search"
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
    >
      Search
    </Link>

    <span className="hidden text-right text-xs font-medium text-zinc-500 sm:inline">
      Beyond the broadcast
    </span>
  </div>
</header>


        <section className="py-8 sm:py-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">
            Radio. People. Connection.
          </p>

          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
            What’s live right now?
          </h1>

          <p className="mt-3 max-w-xl leading-6 text-zinc-600">
            Find your favourite RJs, follow their programmes, and connect
            beyond the broadcast.
          </p>
        </section>

        <nav aria-label="Programme sections" className="mb-7 flex flex-wrap gap-2">
          <a
            href="#live"
            className="rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Live now
          </a>
          <a
            href="#upcoming"
            className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
          >
            Upcoming
          </a>
          <a
            href="#previous"
            className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
          >
            Previously aired
          </a>
        </nav>

        <section id="live" className="scroll-mt-5">
          <h2 className="text-xl font-bold text-zinc-900">
            Live programmes
          </h2>
          <p className="mt-1 mb-4 text-sm text-zinc-500">
            Your followed RJs first, then other live shows.
          </p>

          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-orange-700">
            Your followed programmes
          </h3>

          <div className="flex flex-col gap-3">
            {followedProgrammes.map((programme) => (
              <ProgrammeCard key={programme.id} programme={programme} />
            ))}
          </div>

          <h3 className="mt-7 mb-3 text-sm font-bold uppercase tracking-wide text-zinc-600">
            More live programmes
          </h3>

          <div className="flex flex-col gap-3">
            {otherLiveProgrammes.map((programme) => (
              <ProgrammeCard key={programme.id} programme={programme} />
            ))}
          </div>
        </section>

        <section id="upcoming" className="mt-10 scroll-mt-5">
          <h2 className="mb-4 text-xl font-bold text-zinc-900">
            Upcoming programmes
          </h2>
          <div className="flex flex-col gap-3">
            {upcomingProgrammes.map((programme) => (
              <ProgrammeCard key={programme.id} programme={programme} />
            ))}
          </div>
        </section>

        <section id="previous" className="mt-10 scroll-mt-5">
          <h2 className="mb-4 text-xl font-bold text-zinc-900">
            Previously aired
          </h2>
          <div className="flex flex-col gap-3">
            {previousProgrammes.map((programme) => (
              <ProgrammeCard key={programme.id} programme={programme} />
            ))}
          </div>
        </section>

        <p className="mt-8 rounded-xl bg-zinc-100 p-3 text-xs leading-5 text-zinc-600">
          Preview version: programme listings are sample data. Like and Fire are interactive previews. Call RJ uses the programme contact number and may require a compatible calling app or mobile phone.
        </p>

        <footer className="py-8 text-center text-sm text-zinc-500">
          NowRJ · Beyond the broadcast
        </footer>
      </div>
    </main>
  );
}