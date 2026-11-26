/**
 * Server errors since the backend last started: kept in memory (the last 100)
 * so the Super Admin can see them, and counted for the health check. The full
 * details are in the pm2 logs too. Pure (no Nest imports), so it can be tested.
 */
export type ServerError = { at: string; method: string; path: string; status: number; message: string; where: string | null };

const MAX_KEPT = 100;
const kept: ServerError[] = [];
let total = 0;

/** Keeps the path but drops the query string and ids, so no personal data ends up here. */
export function cleanPath(url: string): string {
  return url
    .split('?')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .slice(0, 200);
}

export function recordError(error: unknown, method: string, url: string, status: number, now = new Date()) {
  const err = error instanceof Error ? error : new Error(String(error));
  const where = (err.stack ?? '').split('\n').find((line) => line.includes('/src/') || line.includes('/dist/')) ?? null;
  kept.unshift({
    at: now.toISOString(),
    method,
    path: cleanPath(url),
    status,
    message: err.message.slice(0, 300),
    where: where ? where.trim().replace(/^at /, '').slice(0, 200) : null,
  });
  if (kept.length > MAX_KEPT) kept.length = MAX_KEPT;
  total++;
}

export function recentErrors() {
  return { sinceStart: total, recent: [...kept] };
}

export function errorsSince(ms: number, now = Date.now()) {
  return kept.filter((e) => now - Date.parse(e.at) <= ms).length;
}

/** For tests. */
export function clearErrors() {
  kept.length = 0;
  total = 0;
}
