import Link from "next/link";
import { ArrowLeft, Radio, Clock } from "lucide-react";

export const instant = false;

const programmes = {
"morning-vibes": {
title: "Morning Vibes",
rj: "Ananya",
rjSlug: "ananya",
station: "Radio Mango",
location: "Kerala",
schedule: "Morning show",
time: "Live now",
description:
"Start your day with music, stories and conversations. Join Ananya for a refreshing mix of entertainment and listener connection.",
},
"drive-time": {
title: "Drive Time",
rj: "Arjun",
rjSlug: "arjun",
station: "Club FM",
location: "Kerala",
schedule: "Drive-time show",
time: "Live now",
description:
"Make your journey more enjoyable with music, entertainment and the latest conversations from the world of radio.",
},
};

export default async function ProgrammePage({
params,
}: {
params: Promise<{ slug: string }>;
}) {
const { slug } = await params;
const programme =
programmes[slug as keyof typeof programmes];

if (!programme) {
return ( <main className="min-h-screen px-4 py-8 sm:px-8"> <div className="mx-auto max-w-3xl"> <Link
         href="/"
         className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700"
       > <ArrowLeft size={16} aria-hidden="true" />
Back to programmes </Link>

      <h1 className="mt-8 text-2xl font-bold text-zinc-900">
        Programme not found
      </h1>

      <p className="mt-2 text-zinc-600">
        This programme is not available in the preview.
      </p>
    </div>
  </main>
);

}

return ( <main className="min-h-screen px-4 py-5 sm:px-8"> <div className="mx-auto max-w-3xl"> <header className="flex items-center justify-between gap-3"> <Link
         href="/"
         className="text-2xl font-extrabold tracking-tight text-zinc-900"
       >
Now<span className="text-orange-600">RJ</span> </Link>

      <span className="text-right text-xs font-medium text-zinc-500 sm:text-sm">
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
      <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">
        Programme details
      </p>

      <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-700">
        <Radio size={16} aria-hidden="true" />
        {programme.time}
      </p>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
        {programme.title}
      </h1>

      <p className="mt-3 text-base leading-7 text-zinc-600">
        {programme.description}
      </p>

      <div className="mt-6 space-y-4 border-t border-zinc-100 pt-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">
            {programme.rj.charAt(0)}
          </div>

          <div>
            <p className="text-sm text-zinc-500">
              Your radio jockey
            </p>
            <Link
              href={`/rj/${programme.rjSlug}`}
              className="mt-1 inline-block font-bold text-zinc-900 hover:text-orange-700"
            >
              RJ {programme.rj}
            </Link>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Radio
            size={20}
            className="mt-0.5 text-orange-600"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm text-zinc-500">Station</p>
            <p className="font-semibold text-zinc-900">
              {programme.station} · {programme.location}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock
            size={20}
            className="mt-0.5 text-orange-600"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm text-zinc-500">
              Programme schedule
            </p>
            <p className="font-semibold text-zinc-900">
              {programme.schedule}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Exact broadcast timings will be added later.
            </p>
          </div>
        </div>
      </div>

      <Link
        href={`/rj/${programme.rjSlug}`}
        className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700"
      >
        View RJ profile
      </Link>
    </section>

    <footer className="py-8 text-center text-sm text-zinc-500">
      NowRJ · Beyond the broadcast
    </footer>
  </div>
</main>

);
}
