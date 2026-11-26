import { fetchPage } from "../../lib/public-pages";
import { OG_SIZE, OG_TYPE, shareCard } from "../../lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "An RJ on NowRJ";

type Rj = { name: string; photoUrl: string | null; station: { name: string } | null; programmes: { name: string }[] };

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rj = await fetchPage<Rj>(`/pages/rj/${encodeURIComponent(slug)}`);
  if (!rj) return shareCard({ kicker: "Live radio", title: "Your favourite RJs, live", lines: ["Request songs, react and call in on NowRJ"] });
  return shareCard({
    kicker: "Radio jockey",
    title: rj.name,
    lines: [rj.station?.name, rj.programmes.slice(0, 2).map((p) => p.name).join(" · ")],
    photoUrl: rj.photoUrl,
    initial: rj.name.trim().charAt(0).toUpperCase(),
    call: `Follow ${rj.name.split(" ").slice(0, 2).join(" ")} and request songs`,
  });
}
