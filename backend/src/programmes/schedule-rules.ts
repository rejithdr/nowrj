/**
 * Pure helpers for programme time slots. Days are 1 = Monday ... 7 = Sunday;
 * times are "HH:MM" or "HH:MM:SS". An end at or before the start runs past
 * midnight into the next day.
 */
export type SlotInput = { days?: number[]; startTime?: string; endTime?: string };
export type Slot = { days: number[]; startTime: string; endTime: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const WEEK = 7 * 1440;

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Validates and normalises one slot; returns an error message or the slot. */
export function normaliseSlot(input: SlotInput): Slot | string {
  const days = [...new Set(input.days ?? [])].map(Number).sort((a, b) => a - b);
  if (days.length === 0) return 'Pick at least one day.';
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return 'Days must be Monday to Sunday.';
  const startTime = input.startTime?.trim() ?? '';
  const endTime = input.endTime?.trim() ?? '';
  if (!TIME.test(startTime) || !TIME.test(endTime)) return 'Start and end times must be HH:MM.';
  if (minutes(startTime) === minutes(endTime)) return 'Start and end time cannot be the same.';
  return { days, startTime: startTime.slice(0, 5), endTime: endTime.slice(0, 5) };
}

/** The slot as minute ranges within one week, split where it wraps Sunday night. */
function weekRanges(slot: Slot): Array<[number, number]> {
  const start = minutes(slot.startTime);
  let end = minutes(slot.endTime);
  if (end <= start) end += 1440;
  const ranges: Array<[number, number]> = [];
  for (const day of slot.days) {
    const from = (day - 1) * 1440 + start;
    const to = (day - 1) * 1440 + end;
    if (to <= WEEK) ranges.push([from, to]);
    else ranges.push([from, WEEK], [0, to - WEEK]);
  }
  return ranges;
}

/** True when the two slots are on air at the same moment on any day. */
export function slotsOverlap(a: Slot, b: Slot): boolean {
  const rb = weekRanges(b);
  return weekRanges(a).some(([s1, e1]) => rb.some(([s2, e2]) => s1 < e2 && s2 < e1));
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type StoredSlot = { daysOfWeek: number[]; startTime: string; endTime: string };

/** Weekday order: earliest first day, then earliest start time. */
export function sortSlots<T extends StoredSlot>(slots: T[]): T[] {
  return [...slots].sort(
    (a, b) =>
      Math.min(...a.daysOfWeek) - Math.min(...b.daysOfWeek) ||
      a.startTime.localeCompare(b.startTime),
  );
}

/** "Mon–Fri 07:00–10:00". */
export function slotLabel(slot: StoredSlot): string {
  return `${describeDays(slot.daysOfWeek)} ${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)}`;
}

/** "Mon–Fri", "Mon, Wed, Fri", "Every day". */
export function describeDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  const isRun = sorted.length >= 3 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (isRun) return `${DAY_NAMES[sorted[0] - 1]}–${DAY_NAMES[sorted[sorted.length - 1] - 1]}`;
  return sorted.map((d) => DAY_NAMES[d - 1]).join(', ');
}
