import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - network_programmes: a programme a network's regional (or head) office
 *   makes once. Each station under that office that carries it gets its own
 *   programmes row (programmes."networkProgrammeId") with its own times and
 *   repeats, so shows, messages, polls and counts work as for any programme.
 * - programme_schedules."isRepeat": a slot that replays an earlier broadcast.
 * - song_requests."askedOf": a pre-recording question for the guest or the RJ.
 * - participations: a listener asks to take part (in a programme or a guest
 *   recording), or nominates someone else. Phone numbers are encrypted, seen
 *   only by the programme team and cleared after 30 days. A nomination airs
 *   only once the team has marked that the person agreed. "nomineePhoneHash"
 *   (a keyed hash, not the number) stops the same person being nominated
 *   again for that programme while a nomination is open or after they said no.
 * - programme_comments (+ replies): private notes from a listener that only
 *   they and the programme's team (RJs, station, network office) see.
 */
export class NetworkProgrammesAndParticipation1795700000000 implements MigrationInterface {
  name = 'NetworkProgrammesAndParticipation1795700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "network_programmes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
        "unitId" uuid REFERENCES "org_units"("id") ON DELETE SET NULL,
        "name" varchar(150) NOT NULL,
        "interactionType" varchar(20) NOT NULL DEFAULT 'song',
        "noticeText" varchar(300),
        "participation" varchar(10) NOT NULL DEFAULT 'off',
        "participationPrompt" varchar(200),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_network_programmes" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_network_programmes_type" CHECK ("interactionType" IN ('song', 'question')),
        CONSTRAINT "CHK_network_programmes_participation" CHECK ("participation" IN ('off', 'take_part', 'nominate', 'both'))
      )`);
    await q.query(`CREATE INDEX "IDX_network_programmes_org" ON "network_programmes" ("organisationId")`);
    await q.query(`
      CREATE TABLE "network_programme_rjs" (
        "networkProgrammeId" uuid NOT NULL REFERENCES "network_programmes"("id") ON DELETE CASCADE,
        "rjId" uuid NOT NULL REFERENCES "rjs"("id") ON DELETE CASCADE,
        CONSTRAINT "PK_network_programme_rjs" PRIMARY KEY ("networkProgrammeId", "rjId")
      )`);

    await q.query(`ALTER TABLE "programmes" ADD "networkProgrammeId" uuid REFERENCES "network_programmes"("id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "programmes" ADD "participation" varchar(10) NOT NULL DEFAULT 'off'`);
    await q.query(`ALTER TABLE "programmes" ADD "participationPrompt" varchar(200)`);
    await q.query(`ALTER TABLE "programmes" ADD CONSTRAINT "CHK_programmes_participation" CHECK ("participation" IN ('off', 'take_part', 'nominate', 'both'))`);
    // A station carries a network programme once.
    await q.query(`CREATE UNIQUE INDEX "UQ_programmes_network_station" ON "programmes" ("networkProgrammeId", "stationId") WHERE "networkProgrammeId" IS NOT NULL`);

    await q.query(`ALTER TABLE "programme_schedules" ADD "isRepeat" boolean NOT NULL DEFAULT false`);

    await q.query(`ALTER TABLE "song_requests" ADD "askedOf" varchar(5)`);
    await q.query(`ALTER TABLE "song_requests" ADD CONSTRAINT "CHK_song_requests_asked_of" CHECK ("askedOf" IS NULL OR "askedOf" IN ('guest', 'rj'))`);

    await q.query(`
      CREATE TABLE "participations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "programmeId" uuid NOT NULL REFERENCES "programmes"("id") ON DELETE CASCADE,
        "guestSessionId" uuid REFERENCES "guest_sessions"("id") ON DELETE CASCADE,
        "listenerId" uuid NOT NULL REFERENCES "listeners"("id") ON DELETE CASCADE,
        "kind" varchar(10) NOT NULL,
        "note" varchar(300),
        "contactPhone" varchar(200),
        "nomineeName" varchar(100),
        "nomineePhone" varchar(200),
        "nomineePhoneHash" varchar(64),
        "status" varchar(10) NOT NULL DEFAULT 'new',
        "agreedAt" TIMESTAMP WITH TIME ZONE,
        "handledByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "handledAt" TIMESTAMP WITH TIME ZONE,
        "phonesClearedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_participations" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_participations_kind" CHECK ("kind" IN ('take_part', 'nominate')),
        CONSTRAINT "CHK_participations_status" CHECK ("status" IN ('new', 'contacted', 'agreed', 'declined', 'done')),
        CONSTRAINT "CHK_participations_nominee" CHECK ("kind" <> 'nominate' OR "nomineeName" IS NOT NULL)
      )`);
    await q.query(`CREATE INDEX "IDX_participations_programme" ON "participations" ("programmeId", "createdAt")`);
    await q.query(`CREATE INDEX "IDX_participations_listener" ON "participations" ("listenerId")`);
    await q.query(`CREATE INDEX "IDX_participations_nominee" ON "participations" ("programmeId", "nomineePhoneHash") WHERE "nomineePhoneHash" IS NOT NULL`);
    await q.query(`CREATE INDEX "IDX_participations_session" ON "participations" ("guestSessionId") WHERE "guestSessionId" IS NOT NULL`);

    await q.query(`
      CREATE TABLE "programme_comments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "programmeId" uuid NOT NULL REFERENCES "programmes"("id") ON DELETE CASCADE,
        "listenerId" uuid NOT NULL REFERENCES "listeners"("id") ON DELETE CASCADE,
        "body" varchar(500) NOT NULL,
        "seenAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_programme_comments" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_programme_comments_programme" ON "programme_comments" ("programmeId", "createdAt")`);
    await q.query(`CREATE INDEX "IDX_programme_comments_listener" ON "programme_comments" ("listenerId")`);
    await q.query(`
      CREATE TABLE "programme_comment_replies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "commentId" uuid NOT NULL REFERENCES "programme_comments"("id") ON DELETE CASCADE,
        "listenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "asLabel" varchar(160) NOT NULL,
        "body" varchar(500) NOT NULL,
        "readAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_programme_comment_replies" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_programme_comment_replies_comment" ON "programme_comment_replies" ("commentId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "programme_comment_replies"`);
    await q.query(`DROP TABLE "programme_comments"`);
    await q.query(`DROP TABLE "participations"`);
    await q.query(`ALTER TABLE "song_requests" DROP CONSTRAINT "CHK_song_requests_asked_of"`);
    await q.query(`ALTER TABLE "song_requests" DROP COLUMN "askedOf"`);
    await q.query(`ALTER TABLE "programme_schedules" DROP COLUMN "isRepeat"`);
    await q.query(`DROP INDEX "UQ_programmes_network_station"`);
    await q.query(`ALTER TABLE "programmes" DROP CONSTRAINT "CHK_programmes_participation"`);
    await q.query(`ALTER TABLE "programmes" DROP COLUMN "participationPrompt"`);
    await q.query(`ALTER TABLE "programmes" DROP COLUMN "participation"`);
    await q.query(`ALTER TABLE "programmes" DROP COLUMN "networkProgrammeId"`);
    await q.query(`DROP TABLE "network_programme_rjs"`);
    await q.query(`DROP TABLE "network_programmes"`);
  }
}
