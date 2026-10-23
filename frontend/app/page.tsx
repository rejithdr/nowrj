import { SERVER_API_URL } from "./lib/config";

import Link from "next/link";
import { connection } from "next/server";
import AuthControls from "./AuthControls";
import ShowCard, { type ApiShow } from "./ShowCard";
import { ShowReactionsProvider } from "./ShowReactions";
import { ProgrammeRow, type ProgrammeSummary } from "./lib/public-pages";
export const instant = false;

export default async function Home() {
  // Live shows depend on the current time, so this page is rendered on every visit.
  await connection();
  let programmes: ProgrammeSummary[] = [];
  let shows: { live: ApiShow[]; upcoming: ApiShow[]; recent: ApiShow[] } = {
    live: [],
    upcoming: [],
    recent: [],
  };
  let showsLoaded = false;
  const now = new Date();

  try {
    const [programmeResponse, showsResponse] = await Promise.all([
      fetch(`${SERVER_API_URL}/pages/programmes`, { cache: "no-store" }),
      fetch(`${SERVER_API_URL}/shows/now`, { cache: "no-store" }),
    ]);
    if (showsResponse.ok) {
      shows = await showsResponse.json();
      showsLoaded = true;
    }
    if (programmeResponse.ok) {
      programmes = await programmeResponse.json();
    }
  } catch {
    // The page still renders; the notice below explains that shows could not be loaded.
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

  <div className="flex items-center gap-3">
    <Link
      href="/search"
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
    >
      Search
    </Link>
    <AuthControls />
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
            Live shows could not be loaded right now. Please refresh in a minute.
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
            <p className="mb-4 text-sm text-zinc-500">You can still Like or Fire a show for 4 hours after it ends.</p>
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
            {programmes.map((programme) => (
              <ProgrammeRow key={programme.id} programme={programme} />
            ))}
            {programmes.length === 0 ? <p className="text-sm text-zinc-600">No programmes yet.</p> : null}
          </div>
        </section>

      </div>
    </main>
  );
}