import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

/**
 * A random id kept in a cookie on the listener's phone, so signed-out
 * listeners can tap Like, Fire or vote once per show without an account.
 * It identifies the device only, never a person. When the listener signs in,
 * what the device did moves to their account (see mergeDeviceIntoListener).
 */
export const DEVICE_COOKIE = 'nowrj_device';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readDeviceId(req: Request): string | null {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === DEVICE_COOKIE) {
      const value = decodeURIComponent(rest.join('='));
      return UUID.test(value) ? value.toLowerCase() : null;
    }
  }
  return null;
}

/** The device id, setting a new cookie (kept 400 days) if there is none. */
export function ensureDeviceId(req: Request, res: Response): string {
  const existing = readDeviceId(req);
  if (existing) return existing;
  const id = randomUUID();
  res.cookie(DEVICE_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 400 * 24 * 60 * 60 * 1000,
  });
  return id;
}

/** Who is acting: a signed-in listener, or a signed-out device. */
export type Actor = { listenerId: string; deviceId: null } | { listenerId: null; deviceId: string };

export function signedInId(req: Request): string | null {
  return req.isAuthenticated?.() ? (req.user as { id: string }).id : null;
}
