/**
 * SQL: an RJ may use RJ tools (messages, shows, polls, guest sessions,
 * shout-outs, programmes): not suspended by the NowRJ team, not rejected,
 * not deleted. Pending RJs who host a station's programme can still work.
 * Kept free of Nest imports so plain rule files (and their tests) can use it.
 */
export const RJ_CAN_ACT = (alias = 'r') =>
  `(${alias}."suspendedAt" IS NULL AND ${alias}."verificationStatus" NOT IN ('rejected', 'deleted'))`;
