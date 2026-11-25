import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DataSource, type EntityManager } from 'typeorm';
import { signedInId } from '../device';
import { assertStationAccess } from '../orgs/access';
import { writeAudit, changed } from '../onboarding/helpers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown, max: number, label: string, required = false): string | null {
  const t = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!t) {
    if (required) throw new BadRequestException(`Enter the ${label}.`);
    return null;
  }
  if (t.length > max) throw new BadRequestException(`The ${label} can be up to ${max} characters.`);
  return t;
}

/**
 * Station staff (Programmes: Edit) manage recordings: create one, add it to
 * their shows as airings, offer it to other stations, and add recordings
 * offered to them to their own shows.
 */
@Injectable()
export class RecordingsService {
  constructor(readonly dataSource: DataSource) {}

  private async allow(m: EntityManager, listenerId: string, stationId: string, level: 'view' | 'edit') {
    await assertStationAccess(m, listenerId, stationId, 'programmes', level);
  }

  async list(listenerId: string, stationId: string, now = new Date()) {
    const m = this.dataSource.manager;
    await this.allow(m, listenerId, stationId, 'view');
    const recordings = await m.query(
      `
      SELECT r.id, r.title, r."guestName", r.description, r."createdAt",
             r."ownerStationId" = $1 AS mine, os.name AS "ownerStationName",
             COALESCE((SELECT json_agg(json_build_object(
                         'showId', o.id, 'startsAt', o."startsAt", 'endsAt', o."endsAt",
                         'stationId', ra."stationId", 'stationName', s.name, 'programmeName', p.name,
                         'interactions',
                           (SELECT count(*) FROM reactions x WHERE x."showOccurrenceId" = o.id)
                         + (SELECT count(*) FROM song_requests q WHERE q."showOccurrenceId" = o.id)
                         + (SELECT count(*) FROM poll_votes v JOIN polls pl ON pl.id = v."pollId" WHERE pl."showOccurrenceId" = o.id)
                         + (SELECT count(*) FROM engagement_events e WHERE e."showOccurrenceId" = o.id AND e.type = 'call_tap'))
                       ORDER BY o."startsAt")
                FROM recording_airings ra
                JOIN show_occurrences o ON o.id = ra."showOccurrenceId"
                JOIN stations s ON s.id = ra."stationId"
                JOIN programmes p ON p.id = o."programmeId"
               WHERE ra."recordingId" = r.id), '[]') AS airings,
             COALESCE((SELECT json_agg(json_build_object('stationId', s.id, 'stationName', s.name) ORDER BY s.name)
                FROM recording_shares sh JOIN stations s ON s.id = sh."stationId"
               WHERE sh."recordingId" = r.id), '[]') AS "sharedWith"
        FROM recordings r JOIN stations os ON os.id = r."ownerStationId"
       WHERE r."ownerStationId" = $1
          OR EXISTS (SELECT 1 FROM recording_shares sh WHERE sh."recordingId" = r.id AND sh."stationId" = $1)
       ORDER BY r."createdAt" DESC
       LIMIT 100
      `,
      [stationId],
    );
    // Shows of this station in the next 14 days, to pick airings from.
    const shows = await m.query(
      `SELECT o.id, o."startsAt", o."endsAt", p.name AS "programmeName",
              (SELECT ra."recordingId" FROM recording_airings ra WHERE ra."showOccurrenceId" = o.id) AS "recordingId"
         FROM show_occurrences o JOIN programmes p ON p.id = o."programmeId"
        WHERE o."stationId" = $1 AND o.status = 'scheduled'
          AND o."endsAt" > $2 AND o."startsAt" < $2::timestamptz + interval '14 days'
        ORDER BY o."startsAt" LIMIT 200`,
      [stationId, now],
    );
    const stations = await m.query(
      `SELECT id, name, city FROM stations WHERE "isActive" AND id <> $1 ORDER BY name LIMIT 500`,
      [stationId],
    );
    return { recordings, shows, stations };
  }

  async create(listenerId: string, stationId: string, body: Record<string, unknown>) {
    const title = text(body?.title, 120, 'title', true)!;
    const guestName = text(body?.guestName, 120, 'guest name');
    const description = text(body?.description, 500, 'description');
    return this.dataSource.transaction(async (m) => {
      await this.allow(m, listenerId, stationId, 'edit');
      const [rec] = await m.query(
        `INSERT INTO recordings ("ownerStationId", title, "guestName", description, "createdByListenerId")
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [stationId, title, guestName, description, listenerId],
      );
      await writeAudit(m, listenerId, 'recording.created', 'recording', rec.id, { stationId, title });
      if (typeof body?.showId === 'string' && UUID.test(body.showId)) {
        await this.attach(m, listenerId, stationId, rec.id, body.showId);
      }
      return { id: rec.id };
    });
  }

  private async attach(m: EntityManager, listenerId: string, stationId: string, recordingId: string, showId: string, now = new Date()) {
    const [rec] = await m.query(
      `SELECT r.id FROM recordings r
        WHERE r.id = $1 AND (r."ownerStationId" = $2
              OR EXISTS (SELECT 1 FROM recording_shares sh WHERE sh."recordingId" = r.id AND sh."stationId" = $2))`,
      [recordingId, stationId],
    );
    if (!rec) throw new NotFoundException('Recording not found for this station.');
    const [show] = await m.query(
      `SELECT id, "endsAt" FROM show_occurrences WHERE id = $1 AND "stationId" = $2 AND status = 'scheduled'`,
      [showId, stationId],
    );
    if (!show) throw new BadRequestException("Choose one of your station's shows.");
    if (new Date(show.endsAt).getTime() <= now.getTime()) throw new BadRequestException('That show has already ended.');
    const [taken] = await m.query(`SELECT "recordingId" FROM recording_airings WHERE "showOccurrenceId" = $1`, [showId]);
    if (taken) {
      throw new ConflictException(taken.recordingId === recordingId ? 'That show already plays this recording.' : 'That show already plays another recording.');
    }
    await m.query(
      `INSERT INTO recording_airings ("recordingId", "showOccurrenceId", "stationId", "addedByListenerId") VALUES ($1, $2, $3, $4)`,
      [recordingId, showId, stationId, listenerId],
    );
    await writeAudit(m, listenerId, 'recording.airing_added', 'recording', recordingId, { stationId, showId });
  }

  async addAiring(listenerId: string, stationId: string, recordingId: string, showId: unknown) {
    if (typeof showId !== 'string' || !UUID.test(showId)) throw new BadRequestException('Choose a show.');
    return this.dataSource.transaction(async (m) => {
      await this.allow(m, listenerId, stationId, 'edit');
      await this.attach(m, listenerId, stationId, recordingId, showId);
      return { ok: true };
    });
  }

  async removeAiring(listenerId: string, stationId: string, showId: string) {
    return this.dataSource.transaction(async (m) => {
      await this.allow(m, listenerId, stationId, 'edit');
      const [row] = changed(await m.query(
        `DELETE FROM recording_airings WHERE "showOccurrenceId" = $1 AND "stationId" = $2 RETURNING "recordingId"`,
        [showId, stationId],
      ));
      if (!row) throw new NotFoundException('That show does not play a recording.');
      await writeAudit(m, listenerId, 'recording.airing_removed', 'recording', row.recordingId, { stationId, showId });
      return { ok: true };
    });
  }

  /** Only the owning station can offer its recording to another station. */
  async share(listenerId: string, stationId: string, recordingId: string, toStationId: unknown) {
    if (typeof toStationId !== 'string' || !UUID.test(toStationId)) throw new BadRequestException('Choose a station.');
    if (toStationId === stationId) throw new BadRequestException('Choose another station.');
    return this.dataSource.transaction(async (m) => {
      await this.allow(m, listenerId, stationId, 'edit');
      const [rec] = await m.query(`SELECT id FROM recordings WHERE id = $1 AND "ownerStationId" = $2`, [recordingId, stationId]);
      if (!rec) throw new ForbiddenException('Only the station that made the recording can offer it.');
      const [to] = await m.query(`SELECT id FROM stations WHERE id = $1 AND "isActive"`, [toStationId]);
      if (!to) throw new NotFoundException('Station not found.');
      await m.query(
        `INSERT INTO recording_shares ("recordingId", "stationId", "offeredByListenerId") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [recordingId, toStationId, listenerId],
      );
      await writeAudit(m, listenerId, 'recording.shared', 'recording', recordingId, { stationId, toStationId });
      return { ok: true };
    });
  }
}

function requireListener(req: Request) {
  const id = signedInId(req);
  if (!id) throw new UnauthorizedException('Please sign in first.');
  return id;
}

@Controller('stations/:stationId/recordings')
export class RecordingsController {
  constructor(private readonly recordings: RecordingsService) {}

  @Get()
  list(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string) {
    return this.recordings.list(requireListener(req), stationId);
  }

  @Post()
  create(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Body() body: Record<string, unknown>) {
    return this.recordings.create(requireListener(req), stationId, body ?? {});
  }

  @Post(':recordingId/airings')
  addAiring(
    @Req() req: Request,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Param('recordingId', ParseUUIDPipe) recordingId: string,
    @Body() body: { showId?: unknown },
  ) {
    return this.recordings.addAiring(requireListener(req), stationId, recordingId, body?.showId);
  }

  @Delete('airings/:showId')
  removeAiring(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Param('showId', ParseUUIDPipe) showId: string) {
    return this.recordings.removeAiring(requireListener(req), stationId, showId);
  }

  @Post(':recordingId/share')
  share(
    @Req() req: Request,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Param('recordingId', ParseUUIDPipe) recordingId: string,
    @Body() body: { stationId?: unknown },
  ) {
    return this.recordings.share(requireListener(req), stationId, recordingId, body?.stationId);
  }
}

@Module({ controllers: [RecordingsController], providers: [RecordingsService] })
export class RecordingsModule {}
