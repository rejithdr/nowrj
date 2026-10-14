
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Search, MicVocal, Radio, CalendarClock } from "lucide-react";

type Category = "All" | "RJs" | "Stations" | "Programmes";

type SearchItem = {
  name: string;
  category: Exclude<Category, "All">;
  description: string;
  href: string;
  keywords: string;
};

const items: SearchItem[] = [
  {
    name: "Ananya",
    category: "RJs",
    description: "RJ · Radio Mango",
    href: "/rj/ananya",
    keywords: "ananya radio mango morning vibes kerala",
  },
  {
    name: "Arjun",
    category: "RJs",
    description: "RJ · Club FM",
    href: "/rj/arjun",
    keywords: "arjun club fm drive time kerala",
  },
  {
    name: "Meera",
    category: "RJs",
    description: "RJ · Red FM",
    href: "/rj/meera",
    keywords: "meera red fm music mix kerala",
  },
  {
    name: "Rahul",
    category: "RJs",
    description: "RJ · Radio City",
    href: "/rj/rahul",
    keywords: "rahul radio city evening show kerala",
  },
  {
    name: "Nikhil",
    category: "RJs",
    description: "RJ · Club FM",
    href: "/rj/nikhil",
    keywords: "nikhil club fm night beats kerala",
  },
  {
    name: "Radio Mango",
    category: "Stations",
    description: "Radio station · Kerala",
    href: "/station/radio-mango",
    keywords: "radio mango kerala ananya morning vibes",
  },
  {
    name: "Club FM",
    category: "Stations",
    description: "Radio station · Kerala",
    href: "/station/club-fm",
    keywords: "club fm kerala arjun nikhil drive time night beats",
  },
  {
    name: "Red FM",
    category: "Stations",
    description: "Radio station · Kerala",
    href: "/station/red-fm",
    keywords: "red fm kerala meera music mix",
  },
  {
    name: "Radio City",
    category: "Stations",
    description: "Radio station · Kerala",
    href: "/station/radio-city",
    keywords: "radio city kerala rahul evening show",
  },
  {
    name: "Morning Vibes",
    category: "Programmes",
    description: "Ananya · Radio Mango",
    href: "/programme/morning-vibes",
    keywords: "morning vibes ananya radio mango morning",
  },
  {
    name: "Drive Time",
    category: "Programmes",
    description: "Arjun · Club FM",
    href: "/programme/drive-time",
    keywords: "drive time arjun club fm driving",
  },
  {
    name: "Music Mix",
    category: "Programmes",
    description: "Meera · Red FM",
    href: "/programme/music-mix",
    keywords: "music mix meera red fm songs",
  },
  {
    name: "The Evening Show",
    category: "Programmes",
    description: "Rahul · Radio City",
    href: "/programme/evening-show",
    keywords: "evening show rahul radio city",
  },
  {
    name: "Night Beats",
    category: "Programmes",
    description: "Nikhil · Club FM",
    href: "/programme/night-beats",
    keywords: "night beats nikhil club fm night",
  },
  {
    name: "Good Morning Kerala",
    category: "Programmes",
    description: "Ananya · Radio Mango",
    href: "/programme/good-morning",
    keywords: "good morning kerala ananya radio mango",
  },
];

const categories: Category[] = ["All", "RJs", "Stations", "Programmes"];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");

  const results = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return items.filter((item) => {
      const matchesCategory =
        category === "All" || item.category === category;

      const searchableText =
        `${item.name} ${item.description} ${item.keywords}`.toLowerCase();

      const matchesQuery = words.every((word) =>
        searchableText.includes(word)
      );

      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

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

          <span className="text-right text-xs font-medium text-zinc-500 sm:text-sm">
            Beyond the broadcast
          </span>
        </header>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-orange-700"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to home
        </Link>

        <section className="py-7">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">
            Discover NowRJ
          </p>

          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
            Search and discover
          </h1>

          <p className="mt-3 leading-6 text-zinc-600">
            Find your favourite RJs, radio stations and programmes in one place.
          </p>
        </section>

        <section aria-label="Search directory">
          <label htmlFor="directory-search" className="sr-only">
            Search RJs, stations and programmes
          </label>

          <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-zinc-300 bg-white px-4 shadow-sm focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100">
            <Search
              size={21}
              className="shrink-0 text-zinc-500"
              aria-hidden="true"
            />

            <input
              id="directory-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search an RJ, station or programme..."
              className="min-w-0 flex-1 bg-transparent py-3 text-base text-zinc-900 outline-none placeholder:text-zinc-400"
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="shrink-0 rounded-full px-2 py-1 text-sm font-semibold text-orange-700 hover:bg-orange-50"
              >
                Clear
              </button>
            )}
          </div>

          <div
            className="mt-4 flex flex-wrap gap-2"
            aria-label="Filter by category"
          >
            {categories.map((itemCategory) => (
              <button
                key={itemCategory}
                type="button"
                onClick={() => setCategory(itemCategory)}
                aria-pressed={category === itemCategory}
                className={`min-h-10 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  category === itemCategory
                    ? "border-orange-600 bg-orange-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-orange-300 hover:bg-orange-50"
                }`}
              >
                {itemCategory}
              </button>
            ))}
          </div>

          <div className="mt-7 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-zinc-900">
              {query.trim() ? "Search results" : "Explore"}
            </h2>

            <p className="text-sm text-zinc-500">
              {results.length} {results.length === 1 ? "result" : "results"}
            </p>
          </div>

          <div className="mt-3 space-y-3">
            {results.map((item) => (
              <Link
                key={`${item.category}-${item.href}`}
                href={item.href}
                className="flex min-h-20 items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                  {item.category === "RJs" && (
                    <MicVocal size={23} aria-hidden="true" />
                  )}
                  {item.category === "Stations" && (
                    <Radio size={23} aria-hidden="true" />
                  )}
                  {item.category === "Programmes" && (
                    <CalendarClock size={23} aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-zinc-900">{item.name}</h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    {item.description}
                  </p>
                </div>

                <span className="shrink-0 text-xs font-semibold text-orange-700">
                  {item.category}
                </span>
              </Link>
            ))}

            {results.length === 0 && (
              <div className="rounded-2xl border border-dashed border-zinc-300 px-5 py-10 text-center">
                <Search
                  size={28}
                  className="mx-auto text-zinc-400"
                  aria-hidden="true"
                />
                <h3 className="mt-3 font-bold text-zinc-900">
                  No matching results
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Try another name or choose a different category.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCategory("All");
                  }}
                  className="mt-4 min-h-10 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  Reset search
                </button>
              </div>
            )}
          </div>
        </section>

        <p className="mt-8 rounded-xl bg-zinc-100 p-3 text-xs leading-5 text-zinc-600">
          Preview version: search results use sample data. Results will be
          connected to the live NowRJ database when the backend is ready.
        </p>

        <footer className="py-8 text-center text-sm text-zinc-500">
          NowRJ · Beyond the broadcast
        </footer>
      </div>
    </main>
  );
}
