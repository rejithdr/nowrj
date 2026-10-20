import Link from "next/link";
import ShowReactions from "./ShowReactions";
import CallButton from "./CallButton";

export type ApiShow = {
  id: string;
  startsAt: string;
  endsAt: string;
  programme: { name: string; slug: string; callInPhone: string | null };
  station: { name: string; slug: string } | null;
  invitedStationName: string | null;
  hosts: { id: string; name: string; slug: string; photoUrl: string | null }[];
  likes: number;
  fires: number;
  canReact: boolean;
};

const TZ = "Asia/Kolkata";

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
}

function indiaDay(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: TZ });
}

function dayWord(iso: string, now: Date) {
  const day = indiaDay(new Date(iso));
  if (day === indiaDay(now)) return "Today";
  if (day === indiaDay(new Date(now.getTime() + 864e5))) return "Tomorrow";
  if (day === indiaDay(new Date(now.getTime() - 864e5))) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
}

export default function ShowCard({ show, kind, now }: { show: ApiShow; kind: "live" | "upcoming" | "recent"; now: Date }) {
  const range = `${clock(show.startsAt)}–${clock(show.endsAt)}`;
  const when =
    kind === "live" ? `On air · ${range}` : `${dayWord(show.startsAt, now)} · ${range}`;
  const initial = (show.hosts[0]?.name ?? show.programme.name).trim().charAt(0).toUpperCase();
  const notYet =
    kind === "upcoming"
      ? `Like and Fire open when the show starts at ${clock(show.startsAt)}.`
      : "Reactions for this show have closed.";

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-zinc-900">
              <Link href={`/programme/${show.programme.slug}`} className="hover:text-orange-700">
                {show.programme.name}
              </Link>
            </h3>
            {kind === "live" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-red-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600" aria-hidden="true" />
                Live
              </span>
            ) : null}
          </div>
          {show.hosts.length ? (
            <p className="mt-0.5 text-sm">
              {show.hosts.map((rj, i) => (
                <span key={rj.id}>
                  {i > 0 ? ", " : ""}
                  <Link href={`/rj/${rj.slug}`} className="font-semibold text-orange-700 hover:text-orange-800">
                    {rj.name}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
          <p className="mt-0.5 text-sm text-zinc-600">
            {show.station ? (
              <Link href={`/station/${show.station.slug}`} className="hover:text-orange-700">
                {show.station.name}
              </Link>
            ) : (
              show.invitedStationName ?? "Station not assigned"
            )}
          </p>
          <p className={`mt-1 text-xs font-semibold ${kind === "live" ? "text-red-700" : "text-orange-700"}`}>{when}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
        <ShowReactions
          showId={show.id}
          likes={show.likes}
          fires={show.fires}
          canReact={show.canReact}
          notYetMessage={notYet}
        />
        {kind === "live" && show.programme.callInPhone ? (
          <CallButton showId={show.id} phone={show.programme.callInPhone} />
        ) : null}
      </div>
    </article>
  );
}
