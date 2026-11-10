import Link from "next/link";
import { CalendarPlus, Clock, MessageCircleQuestion, Radio, Share2 } from "lucide-react";
import SongRequestButton from "../SongRequestButton";

export type GuestSession = {
  id: string;
  guestName: string;
  guestLine: string | null;
  photoUrl: string | null;
  recordingAt: string;
  airAt: string | null;
  closesAt: string;
  programme: { id: string; name: string; slug: string; noticeText: string | null };
  station: { name: string; slug: string } | null;
  hosts: { id: string; name: string; slug: string; photoUrl: string | null }[];
};

const TZ = "Asia/Kolkata";
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

/** Google Calendar "add event" link for the air time (one hour long). */
function calendarLink(g: GuestSession) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(g.airAt!);
  const end = new Date(start.getTime() + 3600 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${g.guestName} on ${g.programme.name}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Listen to ${g.guestName} on ${g.programme.name}${g.station ? `, ${g.station.name}` : ""}. Check NowRJ for your question: https://nowrj.com/programme/${g.programme.slug}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function shareLink(g: GuestSession) {
  const text =
    `I'm sending a question to ${g.guestName} on ${g.programme.name}` +
    (g.station ? ` (${g.station.name})` : "") +
    (g.airAt ? `, airing ${when(g.airAt)}` : "") +
    `. Ask yours before ${clock(g.closesAt)}: https://nowrj.com/programme/${g.programme.slug}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** "Ask the guest": a pre-recorded guest show taking questions before the recording. */
export function GuestCard({ guest }: { guest: GuestSession }) {
  return (
    <article className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        {guest.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={guest.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700" aria-hidden="true">
            <MessageCircleQuestion size={26} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Ask the guest</p>
          <h3 className="text-lg font-bold text-zinc-900">
            {guest.guestName}
            {guest.guestLine ? <span className="font-normal text-zinc-600"> · {guest.guestLine}</span> : null}
          </h3>
          <p className="text-sm text-zinc-700">
            on{" "}
            <Link href={`/programme/${guest.programme.slug}`} className="font-semibold text-orange-700 hover:text-orange-800">
              {guest.programme.name}
            </Link>
            {guest.hosts.length ? (
              <>
                {" "}with{" "}
                {guest.hosts.map((rj, i) => (
                  <span key={rj.id}>
                    {i > 0 ? ", " : ""}
                    <Link href={`/rj/${rj.slug}`} className="font-semibold text-orange-700 hover:text-orange-800">RJ {rj.name}</Link>
                  </span>
                ))}
              </>
            ) : null}
          </p>
          {guest.station ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-zinc-600">
              <Radio size={14} aria-hidden="true" />
              <Link href={`/station/${guest.station.slug}`} className="hover:text-orange-700">{guest.station.name}</Link>
            </p>
          ) : null}
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">
            <Clock size={13} aria-hidden="true" />
            Questions close at {clock(guest.closesAt)}
            {guest.airAt ? ` · airs ${when(guest.airAt)}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <SongRequestButton showId={guest.id} programmeName={guest.guestName} mode="question" notice={guest.programme.noticeText} guest />
        {guest.airAt ? (
          <a href={calendarLink(guest)} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-orange-50">
            <CalendarPlus size={15} aria-hidden="true" /> Add to calendar
          </a>
        ) : null}
        <a href={shareLink(guest)} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-orange-50">
          <Share2 size={15} aria-hidden="true" /> Share
        </a>
      </div>
    </article>
  );
}
