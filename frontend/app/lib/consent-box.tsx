"use client";

import { useState } from "react";

/** The consent wording, a tick box and the signer's typed name. */
export default function ConsentBox({
  version,
  points,
  onChange,
}: {
  version: string;
  points: string[];
  onChange: (value: { agree: boolean; signedName: string }) => void;
}) {
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState("");
  return (
    <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="font-semibold text-zinc-900">Consent to advertise on NowRJ</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
        {points.map((p) => <li key={p}>{p}</li>)}
      </ol>
      <p className="mt-2 text-xs text-zinc-500">Version {version}</p>
      <label className="mt-3 flex items-start gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => {
            setAgree(e.target.checked);
            onChange({ agree: e.target.checked, signedName: name });
          }}
          className="mt-0.5 h-4 w-4 accent-orange-600"
        />
        I agree to the above on behalf of the business, and I am allowed to do so.
      </label>
      <label htmlFor="signed-name" className="mt-3 block text-sm font-medium text-zinc-800">Your full name</label>
      <input
        id="signed-name"
        maxLength={100}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          onChange({ agree, signedName: e.target.value });
        }}
        className="mt-1 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-zinc-900"
      />
    </div>
  );
}
