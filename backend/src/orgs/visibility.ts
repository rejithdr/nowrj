/**
 * SQL that is true when listeners may see programme `p`: neither the station
 * it airs on nor the station that owns it is hidden (see hidden_stations),
 * the NowRJ team has not hidden it, and its owning RJ is not suspended.
 */
export const VISIBLE_PROGRAMME = (alias = 'p') =>
  `(NOT EXISTS (SELECT 1 FROM hidden_stations hs WHERE hs.id = ${alias}."stationId" OR hs.id = ${alias}."ownerStationId")
    AND ${alias}."hiddenAt" IS NULL
    AND NOT EXISTS (SELECT 1 FROM rjs own WHERE own.id = ${alias}."ownerRjId" AND own."suspendedAt" IS NOT NULL))`;

/** SQL: an RJ that listeners may see (active, verified, not suspended). */
export const PUBLIC_RJ = (alias = 'r') =>
  `(${alias}."isActive" AND ${alias}."verificationStatus" IN ('verified', 'legacy') AND ${alias}."suspendedAt" IS NULL)`;
