/** Pure rules for taking part and nominating (no Nest imports, so they can be unit tested). */
export const PARTICIPATION_MODES = ['off', 'take_part', 'nominate', 'both'] as const;
export type ParticipationMode = (typeof PARTICIPATION_MODES)[number];

/** Phone numbers on requests are cleared this long after they were sent. */
export const PHONE_KEEP_DAYS = 30;
/** Open requests one listener may have on one programme. */
export const MAX_OPEN_PER_PROGRAMME = 3;
/** Requests one listener may send in a day, across programmes. */
export const MAX_PER_DAY = 10;

export const PHONE = /^\+?[0-9][0-9 -]{5,18}$/;

export function allows(mode: string, kind: 'take_part' | 'nominate') {
  return mode === 'both' || mode === kind;
}

/** Validates a programme's participation settings (only the fields sent); a string is an error message. */
export function readParticipationSettings(input: { participation?: unknown; participationPrompt?: unknown }) {
  const out: { participation?: ParticipationMode; participationPrompt?: string | null } = {};
  if (input.participation !== undefined) {
    if (typeof input.participation !== 'string' || !(PARTICIPATION_MODES as readonly string[]).includes(input.participation)) {
      return 'Choose who can take part: nobody, listeners themselves, nominations, or both.';
    }
    out.participation = input.participation as ParticipationMode;
  }
  if (input.participationPrompt !== undefined) {
    const t = typeof input.participationPrompt === 'string' ? input.participationPrompt.trim().replace(/\s+/g, ' ') : '';
    if (t.length > 200) return 'The invitation text is too long (200 characters at most).';
    out.participationPrompt = t || null;
  }
  return out;
}

/** Status changes the team may make. A nomination is "done" (aired) only after the person agreed. */
export function nextStatusAllowed(kind: 'take_part' | 'nominate', from: string, to: string, agreedAt: Date | null): string | null {
  const statuses = ['new', 'contacted', 'agreed', 'declined', 'done'];
  if (!statuses.includes(to)) return 'Unknown status.';
  if (from === to) return null;
  if (to === 'done' && kind === 'nominate' && !agreedAt && from !== 'agreed') {
    return 'Mark that the person agreed to be on air before marking this done.';
  }
  return null;
}
