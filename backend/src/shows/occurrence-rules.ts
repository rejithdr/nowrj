/**
 * Pure rules for turning programme time slots into dated shows.
 * Schedules are in Indian time (UTC+05:30, no daylight saving).
 */
export type ScheduleSlot = {
  id: string;
  programmeId: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  validFrom: string;
  validTo: string | null;
};

export type PlannedShow = {
  programmeId: string;
  scheduleId: string;
  airDate: string;
  startsAt: Date;
  endsAt: Date;
};

const IST_OFFSET_MS = 5.5 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/** The date in India at a moment, as YYYY-MM-DD. */
export function indiaDate(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Every show the slots produce whose start date falls in [fromDate, toDate]. */
export function planShows(slots: ScheduleSlot[], fromDate: string, toDate: string): PlannedShow[] {
  const shows: PlannedShow[] = [];
  for (let date = fromDate; date <= toDate; date = addDays(date, 1)) {
    const weekday = isoWeekday(date);
    for (const slot of slots) {
      if (slot.validFrom > date) continue;
      if (slot.validTo !== null && slot.validTo < date) continue;
      if (!slot.daysOfWeek.includes(weekday)) continue;

      const start = slot.startTime.slice(0, 5);
      const end = slot.endTime.slice(0, 5);
      const startsAt = new Date(`${date}T${start}:00+05:30`);
      const endDate = end <= start ? addDays(date, 1) : date;
      const endsAt = new Date(`${endDate}T${end}:00+05:30`);

      shows.push({ programmeId: slot.programmeId, scheduleId: slot.id, airDate: date, startsAt, endsAt });
    }
  }
  return shows;
}

/** Listeners can react from the start of a show until 4 hours after it ends. */
export const REACTION_WINDOW_AFTER_MS = 4 * 3600 * 1000;

export function canReact(show: { startsAt: Date; endsAt: Date; status: string }, now: Date): boolean {
  return (
    show.status === 'scheduled' &&
    show.startsAt.getTime() <= now.getTime() &&
    now.getTime() <= show.endsAt.getTime() + REACTION_WINDOW_AFTER_MS
  );
}
