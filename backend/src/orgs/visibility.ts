/**
 * SQL that is true when listeners may see programme `p`: neither the station
 * it airs on nor the station that owns it is hidden (see hidden_stations).
 */
export const VISIBLE_PROGRAMME = (alias = 'p') =>
  `NOT EXISTS (SELECT 1 FROM hidden_stations hs WHERE hs.id = ${alias}."stationId" OR hs.id = ${alias}."ownerStationId")`;
