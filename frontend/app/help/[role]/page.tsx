import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { NotFound, PageFrame } from "../../lib/public-pages";
import { HELP_ROLES, helpRole } from "../../lib/help-content";

export function generateStaticParams() {
  return HELP_ROLES.map((r) => ({ role: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ role: string }> }): Promise<Metadata> {
  const role = helpRole((await params).role);
  return { title: role ? `How to use NowRJ · ${role.title}` : "How to use NowRJ" };
}

export default async function HelpRolePage({ params }: { params: Promise<{ role: string }> }) {
  const role = helpRole((await params).role);
  if (!role) return <NotFound what="Guide" />;
  return (
    <PageFrame>
      <nav aria-label="Help" className="mt-2 text-sm text-zinc-500">
        <Link href="/help" className="font-semibold text-orange-700 hover:underline">How to use</Link> / {role.title}
      </nav>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900">{role.title}</h1>
      <p className="mt-2 text-zinc-600">{role.who}</p>
      <ol className="mt-6 space-y-3">
        {role.guides.map((g, i) => (
          <li key={g.slug}>
            <Link
              href={`/help/${role.slug}/${g.slug}`}
              className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-orange-300 hover:bg-orange-50"
            >
              <span className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700" aria-hidden="true">{i + 1}</span>
                <span>
                  <span className="block font-bold text-zinc-900">{g.title}</span>
                  <span className="block text-sm text-zinc-600">{g.summary}</span>
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-zinc-400" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </PageFrame>
  );
}
