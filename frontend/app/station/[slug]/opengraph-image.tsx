import { fetchPage } from "../../lib/public-pages";
import { OG_SIZE, OG_TYPE, shareCard } from "../../lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "A radio station on NowRJ";

type Station = { name: string; location: string | null; programmes: { name: string }[] };

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await fetchPage<Station>(`/pages/station/${encodeURIComponent(slug)}`);
  if (!s) return shareCard({ kicker: "Live radio", title: "Your favourite RJs, live", lines: ["Request songs, react and call in on NowRJ"] });
  return shareCard({
    kicker: "Radio station",
    title: s.name,
    lines: [s.location, s.programmes.length ? `${s.programmes.length} programme${s.programmes.length === 1 ? "" : "s"} on NowRJ` : null],
    call: "See what's on and request your song",
  });
}
