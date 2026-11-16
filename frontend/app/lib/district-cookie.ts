/** Shared by the server-rendered home page and the client picker. */
export type District = { id: string; name: string; state: string };

/** Remembers the listener's district on this phone or computer for a year. */
export const DISTRICT_COOKIE = "nowrj_district";
