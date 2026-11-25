/**
 * After restoring an older backup: deletes again every account listed in the
 * erasure log (accounts deleted after that backup was taken would otherwise
 * come back). Run by deploy/after-restore.sh; safe to run more than once.
 *   node dist/scripts/reapply-erasures.js [/srv/nowrj/erasures.log]
 */
import { readFileSync } from 'node:fs';
import { AccountService, ERASURE_LOG } from '../auth/account.service';
import dataSource from '../data-source';

async function main() {
  const file = process.argv[2] ?? ERASURE_LOG;
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    console.log(`No erasure log at ${file}; nothing to do.`);
    return;
  }
  const ids = [...new Set(text.split('\n').map((line) => line.split(' ')[1]).filter((id) => /^[0-9a-f-]{36}$/i.test(id ?? '')))];
  await dataSource.initialize();
  const account = new AccountService(dataSource);
  let again = 0;
  for (const id of ids) {
    const [row] = await dataSource.query(`SELECT "isActive" FROM listeners WHERE id = $1`, [id]);
    if (row?.isActive) {
      await account.deleteAccount(id, 'own_request');
      again++;
    }
  }
  await dataSource.destroy();
  console.log(`Erasure log: ${ids.length} deleted accounts listed, ${again} had come back with the backup and were deleted again.`);
}

void main();
