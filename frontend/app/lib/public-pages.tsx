import Link from "next/link";
import { ArrowLeft, Clock, Radio } from "lucide-react";
import { SERVER_API_URL } from "./config";
import AuthControls from "../AuthControls";
import ShowCard, { type ApiShow } from "../ShowCard";
import { ShowReactionsProvider } from "../ShowReactions";

export type Host = { id: string; name: string; slug: string; photoUrl: string | null };
export type ProgrammeSummary = {
  id: string;
  name: string;
  slug: string;
  scheduleText: string | null;
  station: { name: string; slug: string } | null;
  invitedStationName: string | null;
  hosts: Host[];
};
type Shows = { live: ApiShow[]; upcoming: ApiShow[]; recent: ApiShow[] };

/** Fetches public page data; null when not found or the backend is down. */
export async function fetchPage<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${SERVER_API_URL}${path}`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Live, coming-up and just-aired shows that match `keep`. */
export async function fetchShows(keep: (show: ApiShow) => boolean): Promise<Shows> {
  const all = await fetchPage<Shows>("/shows/now");
  return {
    live: (all?.live ?? []).filter(keep),
    upcoming: (all?.upcoming ?? []).filter(keep),
    recent: (all?.recent ?? []).filter(keep),
  };
}

export function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-4 py-5 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">
            Now<span className="text-orange-600">RJ</span>
          </Link>
          <AuthControls />
        </header>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-orange-700">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to NowRJ
        </Link>
        {children}
      </div>
    </main>
  );
}

export function NotFound({ what }: { what: string }) {
  return (
    <PageFrame>
      <h1 className="mt-6 text-2xl font-bold text-zinc-900">{what} not found</h1>
      <p className="mt-2 text-zinc-600">It may have been removed, or the link is mistyped.</p>
      <Link href="/search" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-orange-600 px-5 font-semibold text-white hover:bg-orange-700">
        Search NowRJ
      </Link>
    </PageFrame>
  );
}

export function Avatar({ name, photoUrl, size }: { name: string; photoUrl: string | null; size: "md" | "lg" }) {
  const box = size === "lg" ? "h-24 w-24 text-4xl" : "h-12 w-12 text-lg";
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt="" className={`${box} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${box} flex shrink-0 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-700`} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** The shows on this page that are live, coming up in 24 hours, or aired in the last 24 hours. */
export function ShowsNow({ shows, empty }: { shows: Shows; empty: string }) {
  const now = new Date();
  const count = shows.live.length + shows.upcoming.length + shows.recent.length;
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold text-zinc-900">On air</h2>
      {count === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600">{empty}</p>
      ) : (
        <ShowReactionsProvider showIds={[...shows.live, ...shows.upcoming, ...shows.recent].map((s) => s.id)}>
          <div className="mt-4 flex flex-col gap-3">
            {shows.live.map((show) => <ShowCard key={show.id} show={show} kind="live" now={now} />)}
            {shows.upcoming.map((show) => <ShowCard key={show.id} show={show} kind="upcoming" now={now} />)}
            {shows.recent.map((show) => <ShowCard key={show.id} show={show} kind="recent" now={now} />)}
          </div>
        </ShowReactionsProvider>
      )}
    </section>
  );
}

export function StationLabel({ programme }: { programme: ProgrammeSummary }) {
  if (programme.station) {
    return (
      <Link href={`/station/${programme.station.slug}`} className="hover:text-orange-700">
        {programme.station.name}
      </Link>
    );
  }
  return <>{programme.invitedStationName ? `${programme.invitedStationName} (not on NowRJ yet)` : "Station not set"}</>;
}

/** A compact programme row: name, hosts, station and weekly schedule. */
export function ProgrammeRow({ programme, showHosts = true }: { programme: ProgrammeSummary; showHosts?: boolean }) {
  return (
    <article className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      {showHosts && programme.hosts[0] ? (
        <Link href={`/rj/${programme.hosts[0].slug}`} aria-label={`View RJ ${programme.hosts[0].name}`} className="shrink-0 rounded-full">
          <Avatar name={programme.hosts[0].name} photoUrl={programme.hosts[0].photoUrl} size="md" />
        </Link>
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700" aria-hidden="true">
          <Radio size={22} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-zinc-900">
          <Link href={`/programme/${programme.slug}`} className="hover:text-orange-700">{programme.name}</Link>
        </h3>
        {showHosts && programme.hosts.length ? (
          <p className="text-sm">
            {programme.hosts.map((rj, i) => (
              <span key={rj.id}>
                {i > 0 ? ", " : ""}
                <Link href={`/rj/${rj.slug}`} className="font-semibold text-orange-700 hover:text-orange-800">{rj.name}</Link>
              </span>
            ))}
          </p>
        ) : null}
        <p className="text-sm text-zinc-600"><StationLabel programme={programme} /></p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700">
          <Clock size={13} aria-hidden="true" />
          {programme.scheduleText ?? "Schedule not set"}
        </p>
      </div>
    </article>
  );
}
