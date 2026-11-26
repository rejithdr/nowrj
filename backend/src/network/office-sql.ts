/**
 * SQL that is true when listener `listenerParam` works at the office of the
 * network programme in `networkProgrammeExpr` with at least Programmes
 * `need`: an active member of that network whose place is the programme's
 * office or above it (no place = head office, which covers everything).
 * Pure (no Nest imports), so rules that use it stay testable.
 */
export function NETWORK_OFFICE(networkProgrammeExpr: string, need: 'view' | 'edit', listenerParam = '$1') {
  const levels = need === 'view' ? `'view', 'edit', 'authorise'` : `'edit', 'authorise'`;
  return `EXISTS (
    SELECT 1
      FROM network_programmes np
      JOIN organisations org ON org.id = np."organisationId" AND org."isActive"
      JOIN org_members om ON om."organisationId" = np."organisationId" AND om.status = 'active' AND om."listenerId" = ${listenerParam}
      JOIN designations d ON d.id = om."designationId" AND d.programmes IN (${levels})
     WHERE np.id = ${networkProgrammeExpr}
       AND (om."unitId" IS NULL OR om."unitId" IN (
             WITH RECURSIVE up AS (
               SELECT u.id, u."parentId", 0 AS depth FROM org_units u WHERE u.id = np."unitId"
               UNION ALL
               SELECT x.id, x."parentId", up.depth + 1 FROM org_units x JOIN up ON x.id = up."parentId" WHERE up.depth < 20
             )
             SELECT id FROM up)))`;
}
