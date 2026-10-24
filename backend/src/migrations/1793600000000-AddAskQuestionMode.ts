import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Ask a question" mode.
 * - programmes.interactionType: 'song' (default) or 'question'
 * - programmes.noticeText: notice shown above the question box (null = default text)
 * - song_requests.kind: 'song' or 'question'; a question keeps its text in
 *   "message" and has no song title.
 */
export class AddAskQuestionMode1793600000000 implements MigrationInterface {
  name = 'AddAskQuestionMode1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "programmes"
        ADD COLUMN "interactionType" varchar(20) NOT NULL DEFAULT 'song',
        ADD COLUMN "noticeText" varchar(300) NULL,
        ADD CONSTRAINT "CHK_programmes_interaction_type" CHECK ("interactionType" IN ('song', 'question'))
    `);
    await queryRunner.query(`
      ALTER TABLE "song_requests"
        ADD COLUMN "kind" varchar(20) NOT NULL DEFAULT 'song',
        ALTER COLUMN "songTitle" DROP NOT NULL,
        DROP CONSTRAINT "CHK_song_requests_title",
        ADD CONSTRAINT "CHK_song_requests_kind" CHECK (
          ("kind" = 'song' AND "songTitle" IS NOT NULL AND length(trim("songTitle")) > 0)
          OR ("kind" = 'question' AND "songTitle" IS NULL AND "message" IS NOT NULL AND length(trim("message")) > 0)
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "song_requests" WHERE "kind" = 'question'`);
    await queryRunner.query(`
      ALTER TABLE "song_requests"
        DROP CONSTRAINT "CHK_song_requests_kind",
        DROP COLUMN "kind",
        ALTER COLUMN "songTitle" SET NOT NULL,
        ADD CONSTRAINT "CHK_song_requests_title" CHECK (length(trim("songTitle")) > 0)
    `);
    await queryRunner.query(`
      ALTER TABLE "programmes"
        DROP CONSTRAINT "CHK_programmes_interaction_type",
        DROP COLUMN "noticeText",
        DROP COLUMN "interactionType"
    `);
  }
}
