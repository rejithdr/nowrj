/**
 * Backend addresses, set per environment:
 * - NEXT_PUBLIC_API_URL: what the browser calls, e.g. https://nowrj.com/api
 * - API_URL_INTERNAL: what server-rendered pages call on the same machine,
 *   e.g. http://127.0.0.1:3000 (falls back to the public address).
 * Both default to the local development backend.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
export const SERVER_API_URL = process.env.API_URL_INTERNAL ?? API_URL;
