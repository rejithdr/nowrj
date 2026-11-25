import type { DataSource } from 'typeorm';

/**
 * When someone signs in, what they did on this phone while signed out
 * becomes theirs: device reactions and poll votes move to the account
 * (skipping any the account already has), and the device rows are removed.
 */
export async function mergeDeviceIntoListener(dataSource: DataSource, deviceId: string, listenerId: string) {
  await dataSource.transaction(async (m) => {
    await m.query(
      `INSERT INTO reactions ("listenerId", "showOccurrenceId", type, "createdAt")
       SELECT $2, "showOccurrenceId", type, "createdAt" FROM reactions WHERE "deviceId" = $1
       ON CONFLICT DO NOTHING`,
      [deviceId, listenerId],
    );
    await m.query(`DELETE FROM reactions WHERE "deviceId" = $1`, [deviceId]);
    await m.query(
      `INSERT INTO poll_votes ("pollId", "optionId", "listenerId", "createdAt")
       SELECT "pollId", "optionId", $2, "createdAt" FROM poll_votes WHERE "deviceId" = $1
       ON CONFLICT DO NOTHING`,
      [deviceId, listenerId],
    );
    await m.query(`DELETE FROM poll_votes WHERE "deviceId" = $1`, [deviceId]);
  });
}
