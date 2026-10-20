const NOWONFM_URL = process.env.NEXT_PUBLIC_NOWONFM_URL ?? "https://nowonfm.com";

/** Shown on every page: where each group goes. */
export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white px-4 py-8 text-sm sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-zinc-500">
          Now<span className="font-semibold text-orange-600">RJ</span> · Beyond the broadcast
        </p>
        <nav aria-label="Site" className="flex flex-wrap gap-x-5 gap-y-2">
          <a href="/" className="text-zinc-700 hover:text-orange-700">Live now</a>
          <a href="/search" className="text-zinc-700 hover:text-orange-700">Find RJs</a>
          <a href="/rj/register" className="text-zinc-700 hover:text-orange-700">For RJs</a>
          <a href="/for-stations" className="text-zinc-700 hover:text-orange-700">For stations</a>
          <a href={NOWONFM_URL} className="text-zinc-700 hover:text-orange-700" rel="noopener">Advertise on Now On FM</a>
        </nav>
      </div>
    </footer>
  );
}
