"use client";

import { useEffect, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { api, Notice, quietButton } from "./ui";

type Mine = {
  code: string;
  joined: { total: number; last7Days: number };
  rjs: { name: string; verificationStatus: string }[];
};
type Vouches = {
  rjId: string;
  verificationStatus: string;
  vouches: { id: string; voucherName: string; note: string | null }[];
};

function ShareRow({ link, message }: { link: string; message: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", link);
    }
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <code className="max-w-full truncate rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800">{link}</code>
      <button type="button" onClick={() => void copy()} className={quietButton}>
        <Copy size={14} aria-hidden="true" />
        {copied ? "Copied" : "Copy"}
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`} target="_blank" rel="noopener noreferrer" className={quietButton}>
        <MessageCircle size={14} aria-hidden="true" />
        WhatsApp
      </a>
    </div>
  );
}

/** The RJ's referral link and results. */
export function ReferralsPanel() {
  const [data, setData] = useState<Mine | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Mine>("/rjs/me/referrals").then(setData).catch((err) => setError(err instanceof Error ? err.message : "Could not load referrals."));
  }, []);
  if (error) return <Notice kind="error" text={error} />;
  if (!data) return <p className="mt-3 text-sm text-zinc-500">Loading…</p>;

  const link = `${window.location.origin}/r/${data.code}`;
  return (
    <div className="mt-2">
      <p className="text-sm text-zinc-600">
        Share this on air, on Instagram and on WhatsApp. Everyone who joins NowRJ through it counts as yours. RJs who join through it are recorded as your referrals: once ads launch on Now On FM, you&apos;ll earn 10% of their share for 12 months.
      </p>
      <ShareRow link={link} message="Follow my show on NowRJ: react live, request songs and call in." />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-sm text-zinc-600">People who joined</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900">{data.joined.total}</p>
          <p className="mt-1 text-xs text-zinc-500">{data.joined.last7Days} in the last 7 days</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-sm text-zinc-600">RJs who joined</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900">{data.rjs.length}</p>
          <p className="mt-1 text-xs text-zinc-500">{data.rjs.filter((r) => ["verified", "legacy"].includes(r.verificationStatus)).length} verified</p>
        </div>
      </div>
      {data.rjs.length ? (
        <ul className="mt-3 divide-y divide-zinc-100 text-sm">
          {data.rjs.map((r) => (
            <li key={r.name} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="font-semibold text-zinc-900">{r.name}</span>
              <span className="text-zinc-600">
                {["verified", "legacy"].includes(r.verificationStatus)
                  ? "Verified"
                  : r.verificationStatus === "rejected"
                    ? "Not verified"
                    : "Waiting for verification"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** For RJs still waiting for verification: their vouch link and the vouches so far. */
export function VouchesPanel() {
  const [data, setData] = useState<Vouches | null>(null);
  useEffect(() => {
    api<Vouches>("/rjs/me/vouches").then(setData).catch(() => setData(null));
  }, []);
  if (!data || data.verificationStatus !== "pending") return null;

  const link = `${window.location.origin}/rj/vouch/${data.rjId}`;
  return (
    <div className="mt-2">
      <p className="text-sm text-zinc-600">
        Speed up your verification: send this link to RJs already on NowRJ who know you. The NowRJ team sees every vouch when reviewing your profile.
      </p>
      <ShareRow link={link} message="I've joined NowRJ as an RJ. Could you vouch that you know me?" />
      <p className="mt-4 text-sm font-semibold text-zinc-800">
        {data.vouches.length ? `${data.vouches.length} RJ${data.vouches.length === 1 ? " has" : "s have"} vouched for you` : "No vouches yet"}
      </p>
      {data.vouches.length ? (
        <ul className="mt-1 space-y-1 text-sm text-zinc-700">
          {data.vouches.map((v) => (
            <li key={v.id}>
              {v.voucherName}
              {v.note ? <span className="text-zinc-500"> · “{v.note}”</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
