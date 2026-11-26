import { cleanPath, clearErrors, errorsSince, recentErrors, recordError } from './error-log';

describe('server error log', () => {
  beforeEach(() => clearErrors());

  it('drops query strings and ids from paths', () => {
    expect(cleanPath('/ads/4cb51493-428f-45cf-b56c-a462f81108a9/lead?phone=98765')).toBe('/ads/:id/lead');
  });

  it('keeps the newest 100 and counts all', () => {
    for (let i = 0; i < 120; i++) recordError(new Error(`boom ${i}`), 'GET', '/x', 500);
    const { sinceStart, recent } = recentErrors();
    expect(sinceStart).toBe(120);
    expect(recent).toHaveLength(100);
    expect(recent[0].message).toBe('boom 119');
  });

  it('counts errors in a time window', () => {
    const now = Date.parse('2026-11-26T10:00:00Z');
    recordError(new Error('old'), 'GET', '/x', 500, new Date(now - 2 * 3600_000));
    recordError(new Error('new'), 'GET', '/x', 500, new Date(now - 60_000));
    expect(errorsSince(3600_000, now)).toBe(1);
  });
});
