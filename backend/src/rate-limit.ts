import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';

/**
 * A simple in-memory limit per network address (one API process). Generous,
 * because many phones in India share one mobile-network address; it stops
 * scripts, not people. Signed-out counts stay best effort.
 */
const hits = new Map<string, number[]>();
let sweeps = 0;

export function limit(req: Request, bucket: string, max: number, windowMs: number, message = 'Too many requests. Please try again a little later.') {
  const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  const key = `${bucket}|${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
  }
  recent.push(now);
  hits.set(key, recent);
  // Now and then, forget addresses that went quiet.
  if (++sweeps % 1000 === 0) {
    for (const [k, times] of hits) if (!times.some((t) => now - t < 60 * 60 * 1000)) hits.delete(k);
  }
}

export const HOUR = 60 * 60 * 1000;
