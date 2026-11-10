import { guestQuestionsOpen, guestWindow } from './guest-rules';

describe('guest question window', () => {
  const recordingAt = new Date('2026-11-20T10:00:00Z');
  const at = (iso: string) => new Date(iso);

  it('opens 24 hours and closes 2 hours before the recording', () => {
    expect(guestWindow(recordingAt)).toEqual({ opensAt: at('2026-11-19T10:00:00Z'), closesAt: at('2026-11-20T08:00:00Z') });
  });

  it.each([
    ['2026-11-19T09:59:59Z', false],
    ['2026-11-19T10:00:00Z', true],
    ['2026-11-20T07:59:59Z', true],
    ['2026-11-20T08:00:00Z', false],
    ['2026-11-20T11:00:00Z', false],
  ])('at %s open is %s', (now, open) => {
    expect(guestQuestionsOpen({ recordingAt, status: 'scheduled' }, at(now))).toBe(open);
  });

  it('is closed when the session is cancelled', () => {
    expect(guestQuestionsOpen({ recordingAt, status: 'cancelled' }, at('2026-11-20T00:00:00Z'))).toBe(false);
  });
});
