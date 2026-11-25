import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DataSource, type EntityManager } from 'typeorm';
import { ensureDeviceId, readDeviceId, signedInId, type Actor } from '../device';
import { hasStationAccess } from '../orgs/access';
import { canReact } from '../shows/occurrence-rules';
import { CONTACT_RULE_MESSAGE, hasContactDetails } from '../shows/text-rules';

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PollView = {
  id: string;
  question: string;
  open: boolean;
  total: number;
  createdAt: Date;
  options: { id: string; label: string; votes: number }[];
};

type ShowRow = { id: string; startsAt: Date; endsAt: Date; status: string; stationId: string | null };

/**
 * Polls for a set of shows, newest first, with vote counts. A poll counts as
 * open until it is closed or the show's Like/Fire window ends.
 */
export async function pollsForShows(m: EntityManager, showIds: string[], now = new Date()) {
  const byShow = new Map<string, PollView[]>();
  if (!showIds.length) return byShow;
  const rows: {
    id: string; showOccurrenceId: string; question: string; closedAt: Date | null; createdAt: Date;
    startsAt: Date; endsAt: Date; status: string; options: { id: string; label: string; votes: number }[];
  }[] = await m.query(
    `
    SELECT p.id, p."showOccurrenceId", p.question, p."closedAt", p."createdAt",
           o."startsAt", o."endsAt", o.status,
           (SELECT json_agg(json_build_object(
                     'id', op.id, 'label', op.label,
                     'votes', (SELECT count(*)::int FROM poll_votes v WHERE v."optionId" = op.id))
                   ORDER BY op.position)
              FROM poll_options op WHERE op."pollId" = p.id) AS options
    FROM polls p JOIN show_occurrences o ON o.id = p."showOccurrenceId"
    WHERE p."showOccurrenceId" = ANY($1)
    ORDER BY p."createdAt" DESC
    `,
    [showIds],
  );
  for (const r of rows) {
    const show = { startsAt: new Date(r.startsAt), endsAt: new Date(r.endsAt), status: r.status };
    const view: PollView = {
      id: r.id,
      question: r.question,
      open: !r.closedAt && canReact(show, now),
      total: r.options.reduce((sum, o) => sum + o.votes, 0),
      createdAt: r.createdAt,
      options: r.options,
    };
    const list = byShow.get(r.showOccurrenceId) ?? [];
    list.push(view);
    byShow.set(r.showOccurrenceId, list);
  }
  return byShow;
}

function clean(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string') return '';
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length > max) throw new BadRequestException(`${label} can be up to ${max} characters.`);
  return text;
}

@Injectable()
export class PollsService {
  constructor(private readonly dataSource: DataSource) {}

  private async show(m: EntityManager, showId: string): Promise<ShowRow> {
    const [show] = await m.query(
      `SELECT id, "startsAt", "endsAt", status, "stationId" FROM show_occurrences WHERE id = $1`,
      [showId],
    );
    if (!show) throw new NotFoundException('Show not found.');
    return { ...show, startsAt: new Date(show.startsAt), endsAt: new Date(show.endsAt) };
  }

  /** The host RJ ('rj') or station staff who can edit programmes ('station'); otherwise refused. */
  private async role(m: EntityManager, listenerId: string, show: ShowRow): Promise<'rj' | 'station'> {
    const [host] = await m.query(
      `SELECT 1 FROM show_occurrence_hosts h JOIN rjs r ON r.id = h."rjId"
        WHERE h."occurrenceId" = $1 AND r."ownerListenerId" = $2 AND r."isActive"`,
      [show.id, listenerId],
    );
    if (host) return 'rj';
    if (await hasStationAccess(m, listenerId, show.stationId, 'programmes', 'edit')) return 'station';
    throw new ForbiddenException('Only the RJs hosting this show, or its station, can run its polls.');
  }

  async create(listenerId: string, showId: string, body: { question?: unknown; options?: unknown }, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const show = await this.show(m, showId);
      const createdAs = await this.role(m, listenerId, show);
      if (show.status !== 'scheduled' || show.endsAt.getTime() <= now.getTime()) {
        throw new BadRequestException('Polls can be started before or during the show, not after it ends.');
      }
      const question = clean(body?.question, 120, 'The question');
      if (question.length < 3) throw new BadRequestException('Type the poll question.');
      const raw = Array.isArray(body?.options) ? body.options : [];
      const options = raw.map((o, i) => clean(o, 60, `Option ${i + 1}`)).filter(Boolean);
      if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
        throw new BadRequestException(`Give ${MIN_OPTIONS} to ${MAX_OPTIONS} options.`);
      }
      if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
        throw new BadRequestException('Each option must be different.');
      }
      if ([question, ...options].some(hasContactDetails)) throw new BadRequestException(CONTACT_RULE_MESSAGE);
      const [open] = await m.query(`SELECT id FROM polls WHERE "showOccurrenceId" = $1 AND "closedAt" IS NULL`, [showId]);
      if (open) throw new ConflictException('This show already has an open poll. Close it first.');

      const [poll] = await m.query(
        `INSERT INTO polls ("showOccurrenceId", question, "createdByListenerId", "createdAs") VALUES ($1, $2, $3, $4) RETURNING id`,
        [showId, question, listenerId, createdAs],
      );
      for (const [position, label] of options.entries()) {
        await m.query(`INSERT INTO poll_options ("pollId", label, position) VALUES ($1, $2, $3)`, [poll.id, label, position]);
      }
      return (await pollsForShows(m, [showId], now)).get(showId)![0];
    });
  }

  async close(listenerId: string, pollId: string) {
    const m = this.dataSource.manager;
    const [poll] = await m.query(`SELECT "showOccurrenceId" FROM polls WHERE id = $1`, [pollId]);
    if (!poll) throw new NotFoundException('Poll not found.');
    const show = await this.show(m, poll.showOccurrenceId);
    await this.role(m, listenerId, show);
    await m.query(`UPDATE polls SET "closedAt" = now() WHERE id = $1 AND "closedAt" IS NULL`, [pollId]);
    return (await pollsForShows(m, [show.id])).get(show.id)!.find((p) => p.id === pollId);
  }

  /** One vote per listener, or per phone when signed out. Votes can't be changed. */
  async vote(actor: Actor, pollId: string, optionId: unknown, now = new Date()) {
    if (typeof optionId !== 'string' || !UUID.test(optionId)) throw new BadRequestException('Choose an option.');
    const m = this.dataSource.manager;
    const [poll] = await m.query(`SELECT id, "showOccurrenceId", "closedAt" FROM polls WHERE id = $1`, [pollId]);
    if (!poll) throw new NotFoundException('Poll not found.');
    const show = await this.show(m, poll.showOccurrenceId);
    if (poll.closedAt || !canReact(show, now)) throw new BadRequestException('This poll is closed.');
    const [option] = await m.query(`SELECT id FROM poll_options WHERE id = $1 AND "pollId" = $2`, [optionId, pollId]);
    if (!option) throw new BadRequestException('Choose an option from this poll.');
    await m.query(
      `INSERT INTO poll_votes ("pollId", "optionId", "listenerId", "deviceId") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [pollId, optionId, actor.listenerId, actor.deviceId],
    );
    const mine = await this.mine(actor, [pollId]);
    const view = (await pollsForShows(m, [show.id], now)).get(show.id)!.find((p) => p.id === pollId)!;
    return { ...view, myOptionId: mine[pollId] ?? null };
  }

  /** Which option this listener (or phone) chose in each poll. */
  async mine(actor: Actor | null, pollIds: string[]) {
    const result: Record<string, string> = {};
    if (!actor || !pollIds.length) return result;
    const rows: { pollId: string; optionId: string }[] = await this.dataSource.query(
      `SELECT "pollId", "optionId" FROM poll_votes
        WHERE "pollId" = ANY($1) AND ${actor.listenerId ? '"listenerId" = $2' : '"deviceId" = $2'}`,
      [pollIds, actor.listenerId ?? actor.deviceId],
    );
    for (const r of rows) result[r.pollId] = r.optionId;
    return result;
  }
}

function requireListener(req: Request): string {
  const id = signedInId(req);
  if (!id) throw new UnauthorizedException('Please sign in first.');
  return id;
}

@Controller('polls')
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  /** Host RJ or station: start a poll on a show. */
  @Post('show/:showId')
  create(@Req() req: Request, @Param('showId', ParseUUIDPipe) showId: string, @Body() body: { question?: unknown; options?: unknown }) {
    return this.polls.create(requireListener(req), showId, body);
  }

  @Patch(':pollId/close')
  close(@Req() req: Request, @Param('pollId', ParseUUIDPipe) pollId: string) {
    return this.polls.close(requireListener(req), pollId);
  }

  /** Vote. Works signed out too: once per phone (device cookie). */
  @Post(':pollId/vote')
  vote(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @Body() body: { optionId?: unknown },
  ) {
    const listenerId = signedInId(req);
    const actor: Actor = listenerId
      ? { listenerId, deviceId: null }
      : { listenerId: null, deviceId: ensureDeviceId(req, res) };
    return this.polls.vote(actor, pollId, body?.optionId);
  }

  /** ?ids=a,b → { pollId: optionId } for polls this listener or phone voted in. */
  @Get('mine')
  mine(@Req() req: Request, @Query('ids') ids?: string) {
    const list = [...new Set((ids ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
    if (list.length > 100 || list.some((id) => !UUID.test(id))) throw new BadRequestException('Give up to 100 poll ids.');
    const listenerId = signedInId(req);
    const deviceId = readDeviceId(req);
    const actor: Actor | null = listenerId
      ? { listenerId, deviceId: null }
      : deviceId
        ? { listenerId: null, deviceId }
        : null;
    return this.polls.mine(actor, list);
  }
}

@Module({ controllers: [PollsController], providers: [PollsService] })
export class PollsModule {}
