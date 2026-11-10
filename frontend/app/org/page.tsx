"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import AuthControls from "../AuthControls";
import OrgManager from "../lib/org-manager";
import { api, Card, isSignedIn, Notice, primaryButton, signInAndReturn } from "../lib/ui";

type MyOrg = { id: string; name: string; kind: string; designationName: string; manageStaff: boolean; unitName: string | null };

/** Staff and designations for the organisations this person manages. */
export default function OrgPage() {
  const [state, setState] = useState<"loading" | "signedOut" | "ready">("loading");
  const [orgs, setOrgs] = useState<MyOrg[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        if (!(await isSignedIn())) {
          setState("signedOut");
          return;
        }
        const requested = new URLSearchParams(window.location.search).get("id");
        const mine = (await api<MyOrg[]>("/orgs/mine")).filter((o) => o.manageStaff);
        setOrgs(mine);
        setSelected(requested ?? mine[0]?.id ?? null);
        setState("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load your organisations.");
        setState("ready");
      }
    }
    void load();
  }, []);

  function choose(id: string) {
    setSelected(id);
    window.history.replaceState(null, "", `/org?id=${id}`);
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/station/dashboard" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 hover:underline">
            <ArrowLeft size={16} aria-hidden="true" />
            Station dashboard
          </Link>
          <AuthControls />
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-orange-700">Staff &amp; designations</p>

        {state === "loading" ? (
          <p className="mt-6 text-zinc-600"><LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />Loading…</p>
        ) : state === "signedOut" ? (
          <Card>
            <p className="text-zinc-700">Sign in with your Google account to manage your staff.</p>
            <button type="button" onClick={signInAndReturn} className={`${primaryButton} mt-4`}>Sign in with Google</button>
          </Card>
        ) : error ? (
          <Notice kind="error" text={error} />
        ) : !selected ? (
          <Card>
            <h1 className="text-xl font-bold text-zinc-900">Nothing to manage here</h1>
            <p className="mt-2 text-zinc-600">Only staff whose designation lets them manage staff can open this page.</p>
          </Card>
        ) : (
          <>
            {orgs.length > 1 ? (
              <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Your organisations">
                {orgs.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="tab"
                    aria-selected={o.id === selected}
                    onClick={() => choose(o.id)}
                    className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${o.id === selected ? "border-orange-600 bg-orange-600 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-orange-50"}`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            ) : null}
            <OrgManager key={selected} organisationId={selected} />
          </>
        )}
      </div>
    </main>
  );
}
