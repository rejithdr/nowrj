"use client";

import { DEFAULT_QUESTION_NOTICE, type InteractionType } from "./interaction";

const labelClass = "mb-1.5 block text-sm font-medium text-zinc-800";

/** "What listeners can send" plus the notice for question programmes; used by RJ and station forms. */
export function InteractionSettings({
  id,
  type,
  notice,
  onType,
  onNotice,
}: {
  id: string;
  type: InteractionType;
  notice: string;
  onType: (type: InteractionType) => void;
  onNotice: (text: string) => void;
}) {
  return (
    <fieldset>
      <legend className={labelClass}>What listeners can send</legend>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["song", "Song requests"],
            ["question", "Ask a question"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold ${
              type === value ? "border-orange-600 bg-orange-50 text-orange-800" : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            <input type="radio" name={`type-${id}`} value={value} checked={type === value} onChange={() => onType(value)} className="accent-orange-600" />
            {label}
          </label>
        ))}
      </div>
      {type === "question" ? (
        <div className="mt-3">
          <label htmlFor={`notice-${id}`} className={labelClass}>Notice shown above the question box</label>
          <textarea
            id={`notice-${id}`}
            rows={2}
            maxLength={300}
            value={notice}
            onChange={(e) => onNotice(e.target.value)}
            placeholder={DEFAULT_QUESTION_NOTICE}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
          <p className="mt-1 text-xs text-zinc-500">Leave empty to use: “{DEFAULT_QUESTION_NOTICE}”</p>
        </div>
      ) : null}
    </fieldset>
  );
}
