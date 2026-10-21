import Link from "next/link";
import AuthControls from "../AuthControls";

export const CONTACT_EMAIL = "nowonfmindia@gmail.com";
export const EFFECTIVE_DATE = "21 October 2026";

/** Shared frame for the Privacy Policy and Terms pages. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">
            Now<span className="text-orange-600">RJ</span>
          </Link>
          <AuthControls />
        </header>
        <article className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 leading-7 text-zinc-700 sm:p-8 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-zinc-900 [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:font-medium [&_a]:text-orange-700 [&_a]:underline">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">{title}</h1>
          <p className="text-sm text-zinc-500">Effective {EFFECTIVE_DATE}</p>
          {children}
        </article>
      </div>
    </main>
  );
}
