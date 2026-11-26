"use client";

export type ParticipationMode = "off" | "take_part" | "nominate" | "both";

const labelClass = "mb-1.5 block text-sm font-medium text-zinc-800";

/** Whether listeners can ask to take part, nominate someone, both or neither, and the invitation shown to them. */
export function ParticipationSettings({
  id,
  mode,
  prompt,
  onMode,
  onPrompt,
}: {
  id: string;
  mode: ParticipationMode;
  prompt: string;
  onMode: (mode: ParticipationMode) => void;
  onPrompt: (text: string) => void;
}) {
  return (
    <fieldset>
      <legend className={labelClass}>Listeners on the show</legend>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["off", "Not now"],
            ["take_part", "Can ask to take part"],
            ["nominate", "Can nominate someone"],
            ["both", "Both"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold ${
              mode === value ? "border-orange-600 bg-orange-50 text-orange-800" : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            <input type="radio" name={`participation-${id}`} value={value} checked={mode === value} onChange={() => onMode(value)} className="accent-orange-600" />
            {label}
          </label>
        ))}
      </div>
      {mode !== "off" ? (
        <div className="mt-3">
          <label htmlFor={`prompt-${id}`} className={labelClass}>Invitation shown to listeners</label>
          <input
            id={`prompt-${id}`}
            maxLength={200}
            value={prompt}
            onChange={(e) => onPrompt(e.target.value)}
            placeholder={mode === "take_part" ? "Sing a song with us on Friday!" : "Nominate a friend for a wrong-number prank call"}
            className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Requests and nominations arrive in your inbox with phone numbers. A nominated person must agree before anything goes on air.
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
