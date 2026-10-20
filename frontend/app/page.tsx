
import Link from "next/link";
import LikeButton from "./rj/[slug]/LikeButton";
import FireButton from "./rj/[slug]/FireButton";
import { Mic, Phone } from "lucide-react";
import AuthControls from "./AuthControls";
import HomeReactionSummary from "./HomeReactionSummary";
import ShowCard, { type ApiShow } from "./ShowCard";
import { ShowReactionsProvider } from "./ShowReactions";
export const instant = false;
type Programme = {
  id: string;
  title: string;
  rj: string;
  rjSlug?: string;
  rjId?: string;
  rjs?: ApiRj[];
  station: string;
  time: string;
  initials: string;
  contactNumber: string;
};

type ApiProgramme = {
  id: string;
  name: string;
  slug: string;
  rjName: string | null;
  rjs?: ApiRj[];
  startTime: string | null;
  endTime: string | null;
  isActive: boolean;
  stationId: string | null;
  callInPhone?: string | null;
  scheduleText?: string | null;
};

type ApiStation = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  isActive: boolean;
};

type ApiRj = {
  id: string;
  name: string;
  phone: string | null;
  slug: string;
  stationId: string | null;
  isActive: boolean;
};

function ProgrammeCard({ programme }: { programme: Programme }) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
    {programme.rjs && programme.rjs.length > 0 ? (
  <div className="flex shrink-0 items-center gap-2">
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">
      {programme.initials}
    </span>
    <div className="flex min-w-0 flex-col gap-1">
      {programme.rjs.map((rj) => (
        <Link
          key={rj.id}
          href={`/rj/${rj.slug}`}
          aria-label={`View ${rj.name} profile`}
          className="max-w-36 truncate font-semibold text-orange-700 hover:text-orange-800"
        >
          {rj.name}
        </Link>
      ))}
    </div>
  </div>
) : programme.rjSlug ? (
  <Link
    href={`/rj/${programme.rjSlug}`}
    aria-label={`View ${programme.rj} profile`}
    className="group flex min-h-14 shrink-0 items-center gap-2 rounded-xl p-1 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
  >
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700 group-hover:bg-orange-200">
      {programme.initials}
    </span>
    <span className="max-w-36 truncate font-semibold text-orange-700 group-hover:text-orange-800">
      {programme.rj}
    </span>
  </Link>
) : (
  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">
    {programme.initials}
  </div>
)}

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
  {programme.rjId && (
  <>
    <LikeButton rjId={programme.rjId} />
    <FireButton rjId={programme.rjId} />
  </>
)}
 {programme.contactNumber && (
  <a
    href={`tel:${programme.contactNumber}`}
    className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
  >
    <Mic size={16} aria-hidden="true" />
    <Phone size={16} aria-hidden="true" />
    Call RJ
  </a>
)}
      </div>
       <HomeReactionSummary rjId={programme.rjId} />
    </article>
  );
}

export default async function Home() {
  let databaseProgrammes: ApiProgramme[] = [];
  let databaseStations: ApiStation[] = [];
  let databaseRjs: ApiRj[] = [];
  let shows: { live: ApiShow[]; upcoming: ApiShow[]; recent: ApiShow[] } = {
    live: [],
    upcoming: [],
    recent: [],
  };
  let showsLoaded = false;
  const now = new Date();

  try {
    const [programmeResponse, stationResponse, rjResponse, showsResponse] =
      await Promise.all([
        fetch("http://localhost:3000/programmes", { cache: "no-store" }),
        fetch("http://localhost:3000/stations", { cache: "no-store" }),
        fetch("http://localhost:3000/rjs", { cache: "no-store" }),
        fetch("http://localhost:3000/shows/now", { cache: "no-store" }),
      ]);

    if (showsResponse.ok) {
      shows = await showsResponse.json();
      showsLoaded = true;
    }

    if (programmeResponse.ok) {
      databaseProgrammes = await programmeResponse.json();
    }

    if (stationResponse.ok) {
      databaseStations = await stationResponse.json();
    }

    if (rjResponse.ok) {
      databaseRjs = await rjResponse.json();
    }
  } catch {
    // Keep the sample homepage available if the backend is unavailable.
  }

  const databaseProgrammeCards: Programme[] = databaseProgrammes
    .filter((programme) => programme.isActive)
    .map((programme) => {
      const station = databaseStations.find(
        (item) => item.id === programme.stationId && item.isActive,
      );

          const assignedRjs = programme.rjs?.filter((item) => item.isActive) ?? [];

      const rj =
        assignedRjs[0] ??
        databaseRjs.find(
          (item) =>
            item.isActive &&
            item.name.toLowerCase() === programme.rjName?.toLowerCase(),
        );

      return {
        id: programme.slug,
        title: programme.name,
        rj: programme.rjName ?? "RJ not assigned",
        rjSlug: rj?.slug,
        rjId: rj?.id,
        rjs: assignedRjs,
        station: station?.name ?? "Station not assigned",
        time:
          programme.scheduleText ??
          (programme.startTime && programme.endTime
            ? `${programme.startTime.slice(0, 5)}–${programme.endTime.slice(0, 5)}`
            : "Schedule not set"),
        initials: (programme.rjName ?? programme.name).charAt(0).toUpperCase(),
        contactNumber: programme.callInPhone ?? "",
      };
    });
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
    <AuthControls />

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
          <a href="#live" className="rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white">
            Live now{shows.live.length ? ` (${shows.live.length})` : ""}
          </a>
          <a href="#upcoming" className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700">
            Coming up
          </a>
          <a href="#recent" className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700">
            Recently aired
          </a>
          <a href="#all-programmes" className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700">
            All programmes
          </a>
        </nav>

        {!showsLoaded ? (
          <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Live shows could not be loaded. Check that the NowRJ backend is running.
          </p>
        ) : null}

        <ShowReactionsProvider
          showIds={[...shows.live, ...shows.upcoming, ...shows.recent].map((show) => show.id)}
        >
          <section id="live" className="scroll-mt-5">
            <h2 className="mb-4 text-xl font-bold text-zinc-900">Live now</h2>
            {shows.live.length ? (
              <div className="flex flex-col gap-3">
                {shows.live.map((show) => (
                  <ShowCard key={show.id} show={show} kind="live" now={now} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600">
                No shows on air right now.
                {shows.upcoming[0] ? " See what's coming up next below." : ""}
              </p>
            )}
          </section>

          <section id="upcoming" className="mt-10 scroll-mt-5">
            <h2 className="mb-4 text-xl font-bold text-zinc-900">Coming up</h2>
            {shows.upcoming.length ? (
              <div className="flex flex-col gap-3">
                {shows.upcoming.map((show) => (
                  <ShowCard key={show.id} show={show} kind="upcoming" now={now} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-600">Nothing scheduled in the next 24 hours.</p>
            )}
          </section>

          <section id="recent" className="mt-10 scroll-mt-5">
            <h2 className="mb-1 text-xl font-bold text-zinc-900">Recently aired</h2>
            <p className="mb-4 text-sm text-zinc-500">You can still Like or Fire a show for 24 hours after it ends.</p>
            {shows.recent.length ? (
              <div className="flex flex-col gap-3">
                {shows.recent.map((show) => (
                  <ShowCard key={show.id} show={show} kind="recent" now={now} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-600">No shows in the last 24 hours.</p>
            )}
          </section>
        </ShowReactionsProvider>

        <section id="all-programmes" className="mt-10 scroll-mt-5">
          <h2 className="mb-4 text-xl font-bold text-zinc-900">All programmes</h2>
          <div className="flex flex-col gap-3">
            {databaseProgrammeCards.map((programme) => (
              <ProgrammeCard key={programme.id} programme={programme} />
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