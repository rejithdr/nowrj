import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import { NotFound, PageFrame } from "../../../lib/public-pages";
import { HELP_ROLES, helpGuide } from "../../../lib/help-content";
import { HelpShot, HelpText } from "../../../lib/help";

export function generateStaticParams() {
  return HELP_ROLES.flatMap((r) => r.guides.map((g) => ({ role: r.slug, guide: g.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ role: string; guide: string }> }): Promise<Metadata> {
  const { role, guide } = await params;
  const found = helpGuide(role, guide);
  return { title: found ? `${found.guide.title} · How to use NowRJ` : "How to use NowRJ" };
}

export default async function HelpGuidePage({ params }: { params: Promise<{ role: string; guide: string }> }) {
  const { role, guide } = await params;
  const found = helpGuide(role, guide);
  if (!found) return <NotFound what="Guide" />;
  const { role: r, guide: g } = found;
  const at = r.guides.indexOf(g);
  const next = r.guides[at + 1];

  return (
    <PageFrame>
      <nav aria-label="Help" className="mt-2 text-sm text-zinc-500">
        <Link href="/help" className="font-semibold text-orange-700 hover:underline">How to use</Link> /{" "}
        <Link href={`/help/${r.slug}`} className="font-semibold text-orange-700 hover:underline">{r.title}</Link>
      </nav>
      <article className="mt-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">{g.title}</h1>
        <p className="mt-2 text-zinc-600">{g.summary}</p>
        {g.open ? (
          <Link href={g.open.href} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-orange-600 px-5 font-semibold text-white hover:bg-orange-700">
            Open {g.open.label} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : null}
        <ol className="mt-6 space-y-5">
          {g.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white" aria-hidden="true">{i + 1}</span>
              <div className="min-w-0 flex-1 leading-7 text-zinc-700">
                <HelpText text={s.text} />
                {s.shot ? <HelpShot name={s.shot} alt={s.alt ?? ""} /> : null}
              </div>
            </li>
          ))}
        </ol>
        {g.tips?.length ? (
          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <p className="flex items-center gap-2 font-bold"><Lightbulb size={16} aria-hidden="true" /> Good to know</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {g.tips.map((t) => (
                <li key={t}><HelpText text={t} /></li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>
      <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
        <Link href={`/help/${r.slug}`} className="inline-flex min-h-11 items-center font-semibold text-zinc-600 hover:text-orange-700">All guides for {r.title.toLowerCase()}</Link>
        {next ? (
          <Link href={`/help/${r.slug}/${next.slug}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-orange-700 hover:underline">
            Next: {next.title} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </PageFrame>
  );
}
