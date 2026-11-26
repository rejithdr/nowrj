import { fetchPage } from "../../lib/public-pages";
import { OG_SIZE, OG_TYPE, shareCard } from "../../lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "An offer heard on the radio";

type Ad = { title: string; businessName: string; station: { name: string }; heardOn: string | null };

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ad = /^[0-9a-f-]{36}$/i.test(id) ? await fetchPage<Ad>(`/ads/${id}`) : null;
  if (!ad) return shareCard({ kicker: "Live radio", title: "Your favourite RJs, live", lines: ["Request songs, react and call in on NowRJ"] });
  return shareCard({
    kicker: "Offer",
    title: ad.title,
    lines: [ad.businessName, `Heard on ${ad.heardOn ?? ad.station.name}`],
    call: "Tap I'm interested and they'll get in touch",
  });
}
