import { MigrationInterface, QueryRunner } from 'typeorm';

/** The public show list counts Likes and Fires per show; this makes those counts cheap. */
export class ShowCountIndexes1795600000000 implements MigrationInterface {
  name = 'ShowCountIndexes1795600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_reactions_show_type" ON "reactions" ("showOccurrenceId", "type") WHERE "showOccurrenceId" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_reactions_show_type"`);
  }
}
