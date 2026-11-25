import Link from "next/link";
import ShowReactions from "./ShowReactions";
import CallButton from "./CallButton";
import SongRequestButton from "./SongRequestButton";
import ShowPoll from "./ShowPoll";
import type { Poll } from "./lib/poll-types";
import { API_URL } from "./lib/config";

export type ApiShow = {
  id: string;
  startsAt: string;
  endsAt: string;
  programme: {
    name: string;
    slug: string;
    callInPhone: string | null;
    interactionType?: "song" | "question";
    noticeText?: string | null;
  };
  station: { name: string; slug: string } | null;
  invitedStationName: string | null;
  hosts: { id: string; name: string; slug: string; photoUrl: string | null }[];
  likes: number;
  fires: number;
  canReact: boolean;
  /** The recording this show plays, if any (repeats: requests are off). */
  recording?: {
    recordingId: string;
    title: string;
    guestName: string | null;
    repeat: boolean;
    firstAiredAt: string;
    firstStationName: string;
    otherAirings: { showId: string; startsAt: string; stationName: string }[];
  } | null;
  /** The same recording at the same time on other stations (shown as one card). */
  alsoOn?: { showId: string; stationName: string }[];
  /** The latest poll: open to vote in, or the last result. */
  poll?: Poll | null;
  ads?: { id: string; creativeId: string; kind: "sponsored" | "shoutout" | "aired"; title: string; offerText: string; businessName: string; imageVersion: string | null }[];
};

const AD_LABEL = { sponsored: "Sponsored", shoutout: "RJ shout-out · on air", aired: "Heard on this show" } as const;

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
      ? `Like and Fire open at ${clock(show.startsAt)}.`
      : "Like and Fire have closed for this show.";

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        {show.hosts[0] ? (
          <Link href={`/rj/${show.hosts[0].slug}`} aria-label={`View RJ ${show.hosts[0].name}`} className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
            {show.hosts[0].photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={show.hosts[0].photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">
                {initial}
              </span>
            )}
          </Link>
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">
            {initial}
          </span>
        )}
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
              show.invitedStationName ? `${show.invitedStationName} (not on NowRJ yet)` : "Station not assigned"
            )}
          </p>
          <p className={`mt-1 text-xs font-semibold ${kind === "live" ? "text-red-700" : "text-orange-700"}`}>{when}</p>
          {show.alsoOn?.length ? (
            <p className="mt-0.5 text-xs text-zinc-600">Also on {show.alsoOn.map((a) => a.stationName).join(", ")} at the same time</p>
          ) : null}
        </div>
      </div>

      {show.recording ? (
        <div className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${show.recording.repeat ? "bg-sky-200 text-sky-900" : "bg-emerald-100 text-emerald-800"}`}>
              {show.recording.repeat ? "Repeat" : "Premiere"}
            </span>
            <span className="font-semibold text-zinc-900">{show.recording.title}</span>
          </p>
          {show.recording.guestName ? <p className="mt-0.5 text-zinc-700">With {show.recording.guestName}</p> : null}
          {show.recording.repeat ? (
            <p className="mt-0.5 text-xs text-zinc-600">
              First aired {dayWord(show.recording.firstAiredAt, now)} {clock(show.recording.firstAiredAt)} on {show.recording.firstStationName}. Recorded earlier, so requests are off; Like, Fire and polls still work.
            </p>
          ) : null}
          {show.recording.otherAirings.filter((a) => new Date(a.startsAt) > now && !show.alsoOn?.some((x) => x.showId === a.showId)).length ? (
            <p className="mt-0.5 text-xs text-zinc-600">
              Also airs:{" "}
              {show.recording.otherAirings
                .filter((a) => new Date(a.startsAt) > now && !show.alsoOn?.some((x) => x.showId === a.showId))
                .slice(0, 3)
                .map((a) => `${a.stationName} ${dayWord(a.startsAt, now)} ${clock(a.startsAt)}`)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

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
        {kind !== "recent" && !show.recording?.repeat ? <SongRequestButton
            showId={show.id}
            programmeName={show.programme.name}
            mode={show.programme.interactionType ?? "song"}
            notice={show.programme.noticeText ?? null}
          /> : null}
      </div>

      {show.poll ? <ShowPoll poll={show.poll} /> : null}

      {show.ads?.length ? (
        <ul className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
          {show.ads.map((ad) => (
            <li key={ad.id}>
              <Link
                href={`/ad/${ad.id}?show=${show.id}`}
                className={`flex items-center gap-3 rounded-xl p-2 hover:ring-1 hover:ring-orange-300 ${ad.kind === "shoutout" ? "bg-green-50" : ad.kind === "aired" ? "bg-amber-50" : "bg-orange-50"}`}
              >
                {ad.imageVersion ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${API_URL}/ad-creatives/${ad.creativeId}/image?v=${ad.imageVersion}`} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : null}
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{AD_LABEL[ad.kind]}</span>
                  <span className="block truncate text-sm font-semibold text-zinc-900">{ad.businessName}: {ad.title}</span>
                  <span className="block truncate text-xs text-zinc-600">{ad.offerText}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
