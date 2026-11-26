"use client";

import { Repeat, Trash2 } from "lucide-react";

/** One weekly time slot: days (1 = Monday … 7 = Sunday), start and end, and whether it is a repeat. */
export type SlotDraft = { days: number[]; startTime: string; endTime: string; repeat?: boolean };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const emptySlot = (repeat = false): SlotDraft => ({ days: [], startTime: "", endTime: "", repeat });

const inputClass =
  "min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
const quietButton =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-60";

/** Days, start and end of one time slot, with a "Repeat" tick for replays of an earlier broadcast. */
export function SlotEditor({
  slot,
  index,
  idPrefix = "slot",
  onChange,
  onRemove,
}: {
  slot: SlotDraft;
  index: number;
  idPrefix?: string;
  onChange: (slot: SlotDraft) => void;
  onRemove?: () => void;
}) {
  const toggle = (day: number) =>
    onChange({
      ...slot,
      days: slot.days.includes(day) ? slot.days.filter((d) => d !== day) : [...slot.days, day].sort(),
    });
  const preset = (days: number[]) => onChange({ ...slot, days });
  const id = `${idPrefix}-${index}`;

  return (
    <fieldset className={`rounded-xl border bg-white p-3 ${slot.repeat ? "border-sky-200" : "border-zinc-200"}`}>
      <legend className="px-1 text-xs font-semibold text-zinc-600">
        Time slot {index + 1}
        {slot.repeat ? <span className="ml-1.5 rounded-full bg-sky-100 px-2 py-0.5 text-sky-900">Repeat</span> : null}
      </legend>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days it airs">
        {DAYS.map((name, i) => {
          const day = i + 1;
          const on = slot.days.includes(day);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(day)}
              className={`min-h-9 min-w-11 rounded-full border px-2.5 text-sm font-semibold ${
                on ? "border-orange-600 bg-orange-600 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-orange-300"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <button type="button" onClick={() => preset([1, 2, 3, 4, 5])} className="font-semibold text-orange-700 hover:underline">Weekdays</button>
        <button type="button" onClick={() => preset([6, 7])} className="font-semibold text-orange-700 hover:underline">Weekend</button>
        <button type="button" onClick={() => preset([1, 2, 3, 4, 5, 6, 7])} className="font-semibold text-orange-700 hover:underline">Every day</button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`${id}-start`} className="mb-1 block text-xs font-medium text-zinc-700">Starts</label>
          <input id={`${id}-start`} type="time" required value={slot.startTime} onChange={(e) => onChange({ ...slot, startTime: e.target.value })} className={`${inputClass} w-36`} />
        </div>
        <div>
          <label htmlFor={`${id}-end`} className="mb-1 block text-xs font-medium text-zinc-700">Ends</label>
          <input id={`${id}-end`} type="time" required value={slot.endTime} onChange={(e) => onChange({ ...slot, endTime: e.target.value })} className={`${inputClass} w-36`} />
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={Boolean(slot.repeat)} onChange={(e) => onChange({ ...slot, repeat: e.target.checked })} className="h-4 w-4 accent-sky-600" />
          <Repeat size={14} aria-hidden="true" /> Repeat of an earlier broadcast
        </label>
        {onRemove ? (
          <button type="button" onClick={onRemove} className={quietButton} aria-label={`Remove time slot ${index + 1}`}>
            <Trash2 size={14} aria-hidden="true" />
            Remove
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}
