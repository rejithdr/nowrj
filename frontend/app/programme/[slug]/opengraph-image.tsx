import { fetchPage, type ProgrammeSummary } from "../../lib/public-pages";
import { OG_SIZE, OG_TYPE, shareCard } from "../../lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "A programme on NowRJ";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await fetchPage<ProgrammeSummary>(`/pages/programme/${encodeURIComponent(slug)}`);
  if (!p) return shareCard({ kicker: "Live radio", title: "Your favourite RJs, live", lines: ["Request songs, react and call in on NowRJ"] });
  const hosts = p.hosts.map((h) => h.name).join(", ");
  const station = p.station?.name ?? p.invitedStationName;
  return shareCard({
    kicker: "Programme",
    title: p.name,
    lines: [[hosts, station].filter(Boolean).join(" · "), p.scheduleText],
  });
}
