import { OG_SIZE, OG_TYPE, shareCard } from "./lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "NowRJ: your favourite RJs, live";

export default function Image() {
  return shareCard({ kicker: "Live radio", title: "Your favourite RJs, live", lines: ["Follow your RJs and see who's on air now", "Radio, beyond the broadcast"] });
}
