import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteFooter from "./SiteFooter";
import AgeGate from "./AgeGate";
import ShareArrival from "./lib/share-arrival";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Link previews (WhatsApp, Facebook) need full addresses for their pictures.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://nowrj.com"),
  title: "NowRJ — Connect Beyond the Broadcast",
  description:
    "Discover radio jockeys, explore live programmes, and connect with your favourite RJs on NowRJ.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SiteFooter />
        <AgeGate />
        <ShareArrival />
      </body>
    </html>
  );
}
