
import Link from "next/link";
import { ArrowLeft, Radio } from "lucide-react";
import FollowButton from "./FollowButton";
import LikeButton from "./LikeButton";
import FireButton from "./FireButton";

export const instant = false;

export default async function RJProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const name = slug === "ananya" ? "Ananya" : slug;
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-2xl font-extrabold tracking-tight text-zinc-900"
          >
            Now<span className="text-orange-600">RJ</span>
          </Link>
          <span className="text-right text-xs text-zinc-500 sm:text-sm">
            Beyond the broadcast
          </span>
        </header>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-orange-700"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to programmes
        </Link>

        <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-orange-100 text-4xl font-bold text-orange-700"
              aria-label={`Profile placeholder for RJ ${displayName}`}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">
                Radio jockey
              </p>
              <h1 className="mt-1 text-3xl font-extrabold text-zinc-900">
                RJ {displayName}
              </h1>
              <p className="mt-2 flex items-center gap-2 text-zinc-600">
                <Radio size={17} aria-hidden="true" />
                Radio Mango · Kerala
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Bringing music, stories and listeners together.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-zinc-100 pt-5">
             <FollowButton />
            </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold text-zinc-900">
            Today’s programme
          </h2>
          <article className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-sm font-semibold text-orange-700">
              LIVE · Sample schedule
            </p>
            <h3 className="mt-2 text-lg font-bold text-zinc-900">
                <Link
                href="/programme/morning-vibes"
                className="hover:text-orange-700"
                >
                Morning Vibes
                </Link>
            </h3>
            <p className="mt-1 text-sm text-zinc-600">
              Radio Mango · Morning show
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              The programme time will be connected to the actual schedule later.
            </p>
            <div className="flex flex-wrap items-center gap-3">
                <LikeButton />
                <FireButton />
            </div>
          </article>
        </section>

        <p className="mt-8 rounded-xl bg-zinc-100 p-3 text-xs leading-5 text-zinc-600">
          Preview version: this is sample profile information. Follow, Call,
          Like and Fire are not active yet.
        </p>

        <footer className="py-8 text-center text-sm text-zinc-500">
          NowRJ · Beyond the broadcast
        </footer>
      </div>
    </main>
  );
}