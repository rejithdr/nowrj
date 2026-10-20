import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * song_requests: a signed-in listener asks for a song during (or just
 * before) a show. The hosting RJ marks each one played or skipped.
 */
export class AddSongRequests1793100000000 implements MigrationInterface {
  name = 'AddSongRequests1793100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "song_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "showOccurrenceId" uuid NOT NULL,
        "programmeId" uuid NOT NULL,
        "listenerId" uuid NOT NULL,
        "songTitle" varchar(150) NOT NULL,
        "artist" varchar(150) NULL,
        "message" varchar(280) NULL,
        "status" varchar(20) NOT NULL DEFAULT 'new',
        "handledByListenerId" uuid NULL,
        "handledAt" TIMESTAMPTZ NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_song_requests_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_song_requests_status" CHECK ("status" IN ('new', 'played', 'skipped')),
        CONSTRAINT "CHK_song_requests_title" CHECK (length(trim("songTitle")) > 0),
        CONSTRAINT "FK_song_requests_show"
          FOREIGN KEY ("showOccurrenceId") REFERENCES "show_occurrences"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_song_requests_programme"
          FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_song_requests_listener"
          FOREIGN KEY ("listenerId") REFERENCES "listeners"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_song_requests_handled_by"
          FOREIGN KEY ("handledByListenerId") REFERENCES "listeners"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_song_requests_show" ON "song_requests" ("showOccurrenceId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_song_requests_listener" ON "song_requests" ("listenerId", "showOccurrenceId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "song_requests"`);
  }
}
