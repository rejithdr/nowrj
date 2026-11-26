import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { API_URL, SERVER_API_URL } from "./config";

/**
 * The picture shown when a NowRJ link is pasted into WhatsApp, Facebook or
 * anywhere else that shows link previews. 1200 × 630, the size they all use.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

const fontDir = join(process.cwd(), "app/lib/og-fonts");
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 800; style: "normal" }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(fontDir, "inter-latin-800-normal.woff")).then((data) => ({ name: "Inter", data, weight: 800 as const, style: "normal" as const })),
    readFile(join(fontDir, "inter-latin-400-normal.woff")).then((data) => ({ name: "Inter", data, weight: 400 as const, style: "normal" as const })),
    // Malayalam and Tamil names: the same bold face is used for every weight.
    readFile(join(fontDir, "noto-sans-malayalam-malayalam-700-normal.woff")).then((data) => ({ name: "Noto Malayalam", data, weight: 800 as const, style: "normal" as const })),
    readFile(join(fontDir, "noto-sans-malayalam-malayalam-700-normal.woff")).then((data) => ({ name: "Noto Malayalam", data, weight: 400 as const, style: "normal" as const })),
    readFile(join(fontDir, "noto-sans-tamil-tamil-700-normal.woff")).then((data) => ({ name: "Noto Tamil", data, weight: 800 as const, style: "normal" as const })),
    readFile(join(fontDir, "noto-sans-tamil-tamil-700-normal.woff")).then((data) => ({ name: "Noto Tamil", data, weight: 400 as const, style: "normal" as const })),
  ]).catch((e) => {
    fonts = null;
    throw e;
  });
  return fonts;
}

/**
 * The picture renderer draws letters in typed order, but in Malayalam and
 * Tamil some vowel signs (ெ ே ை, െ േ ൈ) are written before the consonant
 * they follow. Move them in front, and split the two-part vowels
 * (ொ ோ ௌ, ൊ ോ ൌ) into their front and back halves.
 */
const SPLIT: Record<string, string> = {
  "\u0BCA": "\u0BC6\u0BBE", "\u0BCB": "\u0BC7\u0BBE", "\u0BCC": "\u0BC6\u0BD7",
  "\u0D4A": "\u0D46\u0D3E", "\u0D4B": "\u0D47\u0D3E", "\u0D4C": "\u0D46\u0D57",
};
export function visualOrder(text: string) {
  const split = text.replace(/[\u0BCA-\u0BCC\u0D4A-\u0D4C]/g, (c) => SPLIT[c] ?? c);
  return split.replace(/([\u0B95-\u0BB9\u0D15-\u0D3A])([\u0BC6-\u0BC8\u0D46-\u0D48])/g, "$2$1");
}

/** Shortens text that would not fit, ending with an ellipsis. */
export function clip(text: string, max: number) {
  const t = visualOrder(text.trim().replace(/\s+/g, " "));
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Fetches a photo as a data URL so a slow or missing image never breaks the card. */
async function photoData(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  // Photos are served by our own API: fetch them on this machine, not over the internet.
  const local = url.startsWith(API_URL) ? SERVER_API_URL + url.slice(API_URL.length) : url;
  if (!/^https?:\/\//.test(local)) return null;
  try {
    const res = await fetch(local, { signal: AbortSignal.timeout(2500) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(png|jpe?g|webp|gif)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3_000_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export type CardInput = {
  /** Small label above the title: "Programme", "Radio jockey"… */
  kicker: string;
  title: string;
  /** One or two short lines under the title. */
  lines?: (string | null | undefined)[];
  /** Round photo (RJs) or a letter in a circle. */
  photoUrl?: string | null;
  initial?: string;
  /** The orange strip at the bottom. */
  call?: string;
};

export async function shareCard({ kicker, title, lines = [], photoUrl, initial, call = "Request songs, react live and call the show" }: CardInput) {
  const [loaded, photo] = await Promise.all([loadFonts(), photoData(photoUrl)]);
  const shown = lines.filter((l): l is string => Boolean(l && l.trim())).slice(0, 2);
  const name = clip(title, 70);
  const big = name.length > 34 ? 64 : 80;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#fff7ed", fontFamily: "Inter, Noto Malayalam, Noto Tamil" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "44px 64px 0" }}>
          <div style={{ display: "flex", fontSize: 52, fontWeight: 800, letterSpacing: -1.5, color: "#18181b" }}>
            Now<span style={{ color: "#ea580c" }}>RJ</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 800, letterSpacing: 3, color: "#c2410c", background: "#ffedd5", padding: "10px 24px", borderRadius: 999, textTransform: "uppercase" }}>
            {kicker}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", padding: "0 64px", gap: 48 }}>
          {photo || initial ? (
            photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} width={240} height={240} alt="" style={{ borderRadius: 999, objectFit: "cover", border: "8px solid #ffffff" }} />
            ) : (
              <div style={{ display: "flex", width: 220, height: 220, borderRadius: 999, background: "#fed7aa", color: "#c2410c", fontSize: 120, fontWeight: 800, alignItems: "center", justifyContent: "center" }}>
                {initial}
              </div>
            )
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", fontSize: big, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5, color: "#18181b" }}>{name}</div>
            {shown.map((line, i) => (
              <div key={i} style={{ display: "flex", marginTop: i ? 10 : 22, fontSize: i ? 32 : 38, fontWeight: 400, color: i ? "#52525b" : "#3f3f46" }}>
                {clip(line, 60)}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ea580c", color: "#ffffff", padding: "28px 64px", fontSize: 32 }}>
          <div style={{ display: "flex", fontWeight: 800 }}>{clip(call, 48)}</div>
          <div style={{ display: "flex", fontWeight: 400 }}>nowrj.com</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: loaded },
  );
}
