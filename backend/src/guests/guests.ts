import { VISIBLE_PROGRAMME } from '../orgs/visibility';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { GuestSession } from '../guest-session.entity';
import { Listener } from '../listener.entity';
import { Programme } from '../programme.entity';
import { SongRequest } from '../song-request.entity';
import { writeAudit } from '../onboarding/helpers';
import { assertStationAccess } from '../orgs/access';
import { imageType, MAX_BYTES, publicApiUrl } from '../rjs/rj-photos';
import { CONTACT_RULE_MESSAGE, hasContactDetails } from '../shows/text-rules';
import {
  canManageProgramme,
  GUEST_CLOSES_BEFORE_MS,
  guestQuestionsOpen,
  guestWindow,
  MAX_GUEST_QUESTIONS,
} from './guest-rules';

const MAX_TEXT = 200;

export type GuestSessionInput = {
  programmeId?: string;
  guestName?: string;
  guestLine?: string | null;
  recordingAt?: string;
  airAt?: string | null;
  status?: string;
};

function text(value: unknown, max: number, label: string): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().replace(/\s+/g, ' ');
  if (!t) return null;
  if (t.length > max) throw new BadRequestException(`${label} is too long (${max} characters at most).`);
  return t;
}

function time(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`${label} is not a valid date and time.`);
  return d;
}

type SessionRow = {
  id: string;
  guestName: string;
  guestLine: string | null;
  photoUrl: string | null;
  recordingAt: Date;
  airAt: Date | null;
  status: string;
  programmeId: string;
  programmeName: string;
  programmeSlug: string;
  noticeText: string | null;
  stationName: string | null;
  stationSlug: string | null;
  hosts: { id: string; name: string; slug: string; photoUrl: string | null }[];
};

@Injectable()
export class GuestsService {
  constructor(private readonly dataSource: DataSource) {}

  private sessions(whereSql: string, params: unknown[]): Promise<SessionRow[]> {
    return this.dataSource.query(
      `
      SELECT g.id, g."guestName", g."guestLine", g."photoUrl", g."recordingAt", g."airAt", g.status,
             p.id AS "programmeId", p.name AS "programmeName", p.slug AS "programmeSlug", p."noticeText",
             s.name AS "stationName", s.slug AS "stationSlug",
             COALESCE((
               SELECT json_agg(json_build_object('id', r.id, 'name', r.name, 'slug', r.slug, 'photoUrl', r."photoUrl") ORDER BY r.name)
                 FROM programme_rjs pr JOIN rjs r ON r.id = pr."rjId"
                WHERE pr."programmeId" = p.id AND r."isActive" AND r."verificationStatus" IN ('verified', 'legacy')
             ), '[]') AS hosts
        FROM guest_sessions g
        JOIN programmes p ON p.id = g."programmeId"
        LEFT JOIN stations s ON s.id = p."stationId" AND s."isActive"
       WHERE ${whereSql}
       ORDER BY g."recordingAt"
      `,
      params,
    );
  }

  private publicShape(row: SessionRow) {
    const { opensAt, closesAt } = guestWindow(new Date(row.recordingAt));
    return {
      id: row.id,
      guestName: row.guestName,
      guestLine: row.guestLine,
      photoUrl: row.photoUrl,
      recordingAt: row.recordingAt,
      airAt: row.airAt,
      opensAt,
      closesAt,
      status: row.status,
      programme: { id: row.programmeId, name: row.programmeName, slug: row.programmeSlug, noticeText: row.noticeText },
      station: row.stationName ? { name: row.stationName, slug: row.stationSlug } : null,
      hosts: row.hosts,
    };
  }

  // ------------------------------------------------------------- listeners

  /** Guest sessions taking questions right now (24 h to 2 h before recording). */
  async open(now = new Date()) {
    const rows = await this.sessions(
      `g.status = 'scheduled' AND p."isActive" AND ${VISIBLE_PROGRAMME()}
       AND g."recordingAt" - interval '24 hours' <= $1 AND g."recordingAt" - interval '2 hours' > $1`,
      [now],
    );
    return rows.map((r) => this.publicShape(r));
  }

  async mine(listenerId: string, sessionId: string) {
    const rows = await this.dataSource.manager.find(SongRequest, {
      where: { listenerId, guestSessionId: sessionId },
      order: { createdAt: 'ASC' },
    });
    return {
      max: MAX_GUEST_QUESTIONS,
      requests: rows.map((r) => ({ id: r.id, kind: r.kind, songTitle: null, artist: null, message: r.message, status: r.status })),
    };
  }

  async ask(listenerId: string, sessionId: string, input: { question?: unknown; message?: unknown }, now = new Date()) {
    const question = text(input.question ?? input.message, MAX_TEXT, 'Question');
    if (!question) throw new BadRequestException('Type your question.');
    if (hasContactDetails(question)) throw new BadRequestException(CONTACT_RULE_MESSAGE);

    return this.dataSource.transaction(async (m) => {
      // Lock the session row so a listener's quick double taps are counted in order.
      const session = await m
        .createQueryBuilder(GuestSession, 'g')
        .setLock('pessimistic_write')
        .where('g.id = :id', { id: sessionId })
        .getOne();
      if (!session) throw new NotFoundException('Guest session not found.');
      if (!guestQuestionsOpen(session, now)) {
        throw new ForbiddenException('Questions for the guest open 24 hours before the recording and close 2 hours before it.');
      }
      const listener = await m.findOneBy(Listener, { id: listenerId, isActive: true });
      if (!listener) throw new NotFoundException('Listener not found.');

      const mine = await m.find(SongRequest, { where: { listenerId, guestSessionId: sessionId } });
      if (mine.length >= MAX_GUEST_QUESTIONS) {
        throw new ForbiddenException(`You can ask the guest up to ${MAX_GUEST_QUESTIONS} questions.`);
      }
      if (mine.some((r) => r.message?.toLowerCase() === question.toLowerCase())) {
        throw new BadRequestException('You have already asked that question.');
      }
      const saved = await m.save(
        m.create(SongRequest, {
          showOccurrenceId: null,
          guestSessionId: session.id,
          programmeId: session.programmeId,
          listenerId,
          kind: 'question',
          songTitle: null,
          artist: null,
          message: question,
          status: 'new',
        }),
      );
      return {
        id: saved.id,
        kind: 'question',
        songTitle: null,
        artist: null,
        message: question,
        status: 'new',
        remaining: MAX_GUEST_QUESTIONS - mine.length - 1,
      };
    });
  }

  // ---------------------------------------------- RJs and station representatives

  private async assertManager(listenerId: string, programmeId: string) {
    if (!(await canManageProgramme(this.dataSource.manager, listenerId, programmeId))) {
      throw new ForbiddenException('Only the programme’s RJs or its station can manage its guest sessions.');
    }
  }

  private async loadForManager(listenerId: string, sessionId: string) {
    const session = await this.dataSource.manager.findOneBy(GuestSession, { id: sessionId });
    if (!session) throw new NotFoundException('Guest session not found.');
    await this.assertManager(listenerId, session.programmeId);
    return session;
  }

  /** Sessions with their questions: recordings from 7 days ago onwards. */
  private async withQuestions(whereSql: string, params: unknown[]) {
    const rows = await this.sessions(`${whereSql} AND g."recordingAt" > now() - interval '7 days'`, params);
    if (!rows.length) return [];
    const questions: { id: string; guestSessionId: string; message: string; status: string; createdAt: Date; listenerName: string | null }[] =
      await this.dataSource.query(
        `SELECT s.id, s."guestSessionId", s.message, s.status, s."createdAt", l."displayName" AS "listenerName"
           FROM song_requests s LEFT JOIN listeners l ON l.id = s."listenerId"
          WHERE s."guestSessionId" = ANY($1)
          ORDER BY s."createdAt"`,
        [rows.map((r) => r.id)],
      );
    return rows.map((r) => ({
      ...this.publicShape(r),
      questions: questions
        .filter((q) => q.guestSessionId === r.id)
        .map((q) => ({
          id: q.id,
          message: q.message,
          status: q.status,
          createdAt: q.createdAt,
          // Only the first name is shown to the RJ and station.
          listenerName: (q.listenerName ?? 'A listener').trim().split(/\s+/)[0],
        })),
    }));
  }

  /** The signed-in RJ's guest sessions, for programmes they host. */
  forRj(listenerId: string) {
    return this.withQuestions(
      `EXISTS (SELECT 1 FROM programme_rjs pr JOIN rjs r ON r.id = pr."rjId"
                WHERE pr."programmeId" = p.id AND r."ownerListenerId" = $1)`,
      [listenerId],
    );
  }

  /** A station's guest sessions, for its approved representatives. */
  async forStation(listenerId: string, stationId: string) {
    await assertStationAccess(this.dataSource.manager, listenerId, stationId, 'programmes', 'view');
    return this.withQuestions(`(p."stationId" = $1 OR p."ownerStationId" = $1)`, [stationId]);
  }

  private validate(input: GuestSessionInput, existing: GuestSession | null, now: Date) {
    const guestName = input.guestName === undefined ? undefined : text(input.guestName, 100, 'Guest name');
    if (guestName === null || (!existing && !guestName)) throw new BadRequestException('Enter the guest’s name.');
    const guestLine = input.guestLine === undefined ? undefined : text(input.guestLine, 100, 'About the guest');
    const recordingAt = input.recordingAt === undefined ? undefined : time(input.recordingAt, 'Recording time');
    if (recordingAt === null || (!existing && !recordingAt)) throw new BadRequestException('Enter the recording date and time.');
    const airAt = input.airAt === undefined ? undefined : time(input.airAt, 'Air time');

    const rec = recordingAt ?? existing!.recordingAt;
    if (recordingAt && recordingAt.getTime() - now.getTime() <= GUEST_CLOSES_BEFORE_MS) {
      throw new BadRequestException('The recording must be more than 2 hours from now, so listeners have time to send questions.');
    }
    const air = airAt === undefined ? existing?.airAt ?? null : airAt;
    if (air && air < rec) throw new BadRequestException('The show cannot air before it is recorded.');
    for (const value of [guestName, guestLine]) {
      if (value && hasContactDetails(value)) throw new BadRequestException(CONTACT_RULE_MESSAGE);
    }
    return { guestName, guestLine, recordingAt, airAt };
  }

  async create(listenerId: string, input: GuestSessionInput, now = new Date()) {
    if (typeof input.programmeId !== 'string') throw new BadRequestException('Choose the programme.');
    const programme = await this.dataSource.manager.findOneBy(Programme, { id: input.programmeId });
    if (!programme) throw new NotFoundException('Programme not found.');
    await this.assertManager(listenerId, programme.id);
    const v = this.validate(input, null, now);
    return this.dataSource.transaction(async (m) => {
      const saved = await m.save(
        m.create(GuestSession, {
          programmeId: programme.id,
          guestName: v.guestName!,
          guestLine: v.guestLine ?? null,
          recordingAt: v.recordingAt!,
          airAt: v.airAt ?? null,
          status: 'scheduled',
          createdByListenerId: listenerId,
        }),
      );
      await writeAudit(m, listenerId, 'guest_session.created', 'guest_session', saved.id, {
        programmeId: programme.id,
        guestName: saved.guestName,
        recordingAt: saved.recordingAt,
      });
      return saved;
    });
  }

  async update(listenerId: string, sessionId: string, input: GuestSessionInput, now = new Date()) {
    const session = await this.loadForManager(listenerId, sessionId);
    if (session.status === 'cancelled') throw new BadRequestException('This guest session was cancelled.');
    if (input.status !== undefined && input.status !== 'cancelled') throw new BadRequestException('Status can only be set to cancelled.');
    const v = this.validate(input, session, now);
    return this.dataSource.transaction(async (m) => {
      const before = { guestName: session.guestName, recordingAt: session.recordingAt, airAt: session.airAt, status: session.status };
      if (v.guestName !== undefined) session.guestName = v.guestName!;
      if (v.guestLine !== undefined) session.guestLine = v.guestLine;
      if (v.recordingAt !== undefined) session.recordingAt = v.recordingAt!;
      if (v.airAt !== undefined) session.airAt = v.airAt;
      if (input.status === 'cancelled') session.status = 'cancelled';
      const saved = await m.save(session);
      await writeAudit(m, listenerId, input.status === 'cancelled' ? 'guest_session.cancelled' : 'guest_session.updated', 'guest_session', session.id, {
        before,
        after: { guestName: saved.guestName, recordingAt: saved.recordingAt, airAt: saved.airAt, status: saved.status },
      });
      return saved;
    });
  }

  /** "Used in recording" (played) once questions have closed; Skip any time; or back to new. */
  async setQuestionStatus(listenerId: string, questionId: string, status: unknown, now = new Date()) {
    if (status !== 'played' && status !== 'skipped' && status !== 'new') {
      throw new BadRequestException('Status must be played, skipped or new.');
    }
    const m = this.dataSource.manager;
    const q = await m.findOneBy(SongRequest, { id: questionId });
    if (!q?.guestSessionId) throw new NotFoundException('Question not found.');
    const session = await this.loadForManager(listenerId, q.guestSessionId);
    if (status === 'played' && now < guestWindow(session.recordingAt).closesAt) {
      throw new BadRequestException('You can mark a question as used once questions have closed, 2 hours before the recording. You can skip it any time.');
    }
    q.status = status;
    q.handledByListenerId = status === 'new' ? null : listenerId;
    q.handledAt = status === 'new' ? null : new Date();
    await m.save(q);
    return { id: q.id, status: q.status };
  }

  async uploadPhoto(listenerId: string, sessionId: string, file: { buffer: Buffer; size: number } | undefined) {
    const session = await this.loadForManager(listenerId, sessionId);
    if (!file?.buffer?.length) throw new BadRequestException('Choose a photo to upload.');
    if (file.size > MAX_BYTES) throw new BadRequestException('That photo is too large. Please use one under 1 MB.');
    const contentType = imageType(file.buffer);
    if (!contentType) throw new BadRequestException('Please upload a JPEG, PNG or WebP photo.');
    const photoUrl = `${publicApiUrl()}/guest-sessions/${session.id}/photo?v=${Date.now()}`;
    await this.dataSource.transaction(async (m) => {
      await m.query(
        `INSERT INTO guest_session_photos ("guestSessionId", data, "contentType", "updatedAt") VALUES ($1, $2, $3, now())
         ON CONFLICT ("guestSessionId") DO UPDATE SET data = EXCLUDED.data, "contentType" = EXCLUDED."contentType", "updatedAt" = now()`,
        [session.id, file.buffer, contentType],
      );
      await m.update(GuestSession, { id: session.id }, { photoUrl });
    });
    return { photoUrl };
  }

  async removePhoto(listenerId: string, sessionId: string) {
    const session = await this.loadForManager(listenerId, sessionId);
    await this.dataSource.transaction(async (m) => {
      await m.query(`DELETE FROM guest_session_photos WHERE "guestSessionId" = $1`, [session.id]);
      await m.update(GuestSession, { id: session.id }, { photoUrl: null });
    });
    return { photoUrl: null };
  }

  async photo(sessionId: string): Promise<{ data: Buffer; contentType: string } | null> {
    const [row] = await this.dataSource.query(
      `SELECT data, "contentType" FROM guest_session_photos WHERE "guestSessionId" = $1`,
      [sessionId],
    );
    return row ?? null;
  }
}

function listenerId(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}

/**
 * /guest-sessions
 *   GET  open                        sessions taking questions now (public)
 *   GET  :id/photo                   guest photo (public)
 *   GET  :id/questions/mine          the listener's own questions
 *   POST :id/questions               ask the guest
 *   GET  rj | station/:stationId     manage: sessions with their questions
 *   POST /, PATCH :id                create, edit or cancel a session
 *   POST|DELETE :id/photo            guest photo
 *   PATCH questions/:questionId      used in recording / skip / new
 */
@Controller('guest-sessions')
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Get('open')
  open() {
    return this.guests.open();
  }

  @Get('rj')
  forRj(@Req() req: Request) {
    return this.guests.forRj(listenerId(req));
  }

  @Get('station/:stationId')
  forStation(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string) {
    return this.guests.forStation(listenerId(req), stationId);
  }

  @Post()
  create(@Req() req: Request, @Body() body: GuestSessionInput) {
    return this.guests.create(listenerId(req), body ?? {});
  }

  @Patch('questions/:questionId')
  setQuestionStatus(@Req() req: Request, @Param('questionId', ParseUUIDPipe) id: string, @Body() body: { status?: string }) {
    return this.guests.setQuestionStatus(listenerId(req), id, body?.status);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: GuestSessionInput) {
    return this.guests.update(listenerId(req), id, body ?? {});
  }

  @Get(':id/questions/mine')
  mine(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.guests.mine(listenerId(req), id);
  }

  @Post(':id/questions')
  ask(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { question?: string; message?: string }) {
    return this.guests.ask(listenerId(req), id, body ?? {});
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_BYTES, files: 1 } }))
  uploadPhoto(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: { buffer: Buffer; size: number } | undefined) {
    return this.guests.uploadPhoto(listenerId(req), id, file);
  }

  @Delete(':id/photo')
  removePhoto(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.guests.removePhoto(listenerId(req), id);
  }

  @Get(':id/photo')
  async photo(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const photo = await this.guests.photo(id);
    if (!photo) throw new NotFoundException('No photo.');
    res.set({
      'Content-Type': photo.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(photo.data);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([GuestSession])],
  controllers: [GuestsController],
  providers: [GuestsService],
})
export class GuestsModule {}
