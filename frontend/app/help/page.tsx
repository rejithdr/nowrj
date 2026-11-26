import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageFrame } from "../lib/public-pages";
import { HELP_ROLES } from "../lib/help-content";

export const metadata: Metadata = { title: "How to use NowRJ" };

export default function HelpHome() {
  return (
    <PageFrame>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900">How to use NowRJ</h1>
      <p className="mt-2 text-zinc-600">Choose what you do on NowRJ to see step-by-step guides.</p>
      <ul className="mt-6 space-y-3">
        {HELP_ROLES.map((role) => (
          <li key={role.slug}>
            <Link
              href={`/help/${role.slug}`}
              className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-orange-300 hover:bg-orange-50"
            >
              <span>
                <span className="block font-bold text-zinc-900">{role.title}</span>
                <span className="block text-sm text-zinc-600">{role.who}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-zinc-400" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-zinc-500">
        Still stuck? Write to <a href="mailto:nowonfmindia@gmail.com" className="font-semibold text-orange-700 underline">nowonfmindia@gmail.com</a>.
      </p>
    </PageFrame>
  );
}
