import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { VISIBLE_PROGRAMME } from '../orgs/visibility';
import { limit, HOUR } from '../rate-limit';
import { CONTACT_RULE_MESSAGE, hasContactDetails } from '../shows/text-rules';
import { readTeamView, teamScope, type TeamView } from './team';

const MAX_BODY = 500;
/** Comments one listener may send to one programme in a day. */
const MAX_PER_DAY = 5;

function body(value: unknown): string {
  const t = typeof value === 'string' ? value.trim() : '';
  if (!t) throw new BadRequestException('Write your comment.');
  if (t.length > MAX_BODY) throw new BadRequestException(`Keep it under ${MAX_BODY} characters.`);
  if (hasContactDetails(t)) throw new BadRequestException(CONTACT_RULE_MESSAGE);
  return t;
}

type Reply = { id: string; asLabel: string; body: string; createdAt: Date };

/**
 * Private comments: a listener writes to a programme's team. Only that
 * listener and the team (the programme's RJs, its station, and for a network
 * programme its network office) can read the comment and the replies.
 */
@Injectable()
export class CommentsService {
  constructor(private readonly dataSource: DataSource) {}

  /** The listener's own comments on a programme, with the team's replies (marked read). */
  async mine(listenerId: string, programmeId: string) {
    const rows: { id: string; body: string; createdAt: Date; seen: boolean; replies: Reply[] }[] = await this.dataSource.query(
      `SELECT c.id, c.body, c."createdAt", c."seenAt" IS NOT NULL AS seen,
              COALESCE((SELECT json_agg(json_build_object('id', r.id, 'asLabel', r."asLabel", 'body', r.body, 'createdAt', r."createdAt") ORDER BY r."createdAt")
                          FROM programme_comment_replies r WHERE r."commentId" = c.id), '[]') AS replies
         FROM programme_comments c
        WHERE c."programmeId" = $1 AND c."listenerId" = $2
        ORDER BY c."createdAt" DESC LIMIT 20`,
      [programmeId, listenerId],
    );
    await this.dataSource.query(
      `UPDATE programme_comment_replies r SET "readAt" = now()
         FROM programme_comments c WHERE c.id = r."commentId" AND c."programmeId" = $1 AND c."listenerId" = $2 AND r."readAt" IS NULL`,
      [programmeId, listenerId],
    );
    return rows;
  }

  /** How many team replies the listener has not read yet, across programmes. */
  async unread(listenerId: string) {
    const [row] = await this.dataSource.query(
      `SELECT count(*)::int AS n FROM programme_comment_replies r JOIN programme_comments c ON c.id = r."commentId"
        WHERE c."listenerId" = $1 AND r."readAt" IS NULL`,
      [listenerId],
    );
    return { unread: row.n as number };
  }

  async create(listenerId: string, programmeId: string, input: { body?: unknown }) {
    const text = body(input.body);
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtext('comment:' || $1 || ':' || $2))`, [listenerId, programmeId]);
      const [p] = await m.query(`SELECT p.id FROM programmes p WHERE p.id = $1 AND p."isActive" AND ${VISIBLE_PROGRAMME()}`, [programmeId]);
      if (!p) throw new NotFoundException('Programme not found.');
      const [{ n }] = await m.query(
        `SELECT count(*)::int AS n FROM programme_comments WHERE "listenerId" = $1 AND "programmeId" = $2 AND "createdAt" > now() - interval '1 day'`,
        [listenerId, programmeId],
      );
      if (n >= MAX_PER_DAY) throw new ForbiddenException(`You can send up to ${MAX_PER_DAY} comments a day to a programme.`);
      const [row] = await m.query(
        `INSERT INTO programme_comments ("programmeId", "listenerId", body) VALUES ($1, $2, $3) RETURNING id, body, "createdAt"`,
        [programmeId, listenerId, text],
      );
      return { ...row, seen: false, replies: [] };
    });
  }

  /** The team's comments inbox. Opening it marks the comments as seen. */
  async forTeam(listenerId: string, view: TeamView) {
    const m = this.dataSource.manager;
    const scope = await teamScope(m, listenerId, view);
    const rows: {
      id: string; body: string; createdAt: Date; seen: boolean; listenerName: string | null;
      programmeId: string; programmeName: string; stationName: string | null; replies: Reply[];
    }[] = await m.query(
      `SELECT c.id, c.body, c."createdAt", c."seenAt" IS NOT NULL AS seen, l."displayName" AS "listenerName",
              p.id AS "programmeId", p.name AS "programmeName", s.name AS "stationName",
              COALESCE((SELECT json_agg(json_build_object('id', r.id, 'asLabel', r."asLabel", 'body', r.body, 'createdAt', r."createdAt") ORDER BY r."createdAt")
                          FROM programme_comment_replies r WHERE r."commentId" = c.id), '[]') AS replies
         FROM programme_comments c
         JOIN programmes p ON p.id = c."programmeId"
         LEFT JOIN stations s ON s.id = p."stationId"
         LEFT JOIN listeners l ON l.id = c."listenerId"
        WHERE ${scope.where} AND c."createdAt" > now() - interval '60 days'
        ORDER BY c."createdAt" DESC
        LIMIT 200`,
      scope.params,
    );
    const unseen = rows.filter((r) => !r.seen).map((r) => r.id);
    if (unseen.length) await m.query(`UPDATE programme_comments SET "seenAt" = now() WHERE id = ANY($1) AND "seenAt" IS NULL`, [unseen]);
    return { canEdit: scope.canEdit, replyAs: scope.label, comments: rows };
  }

  /** A reply from the team, signed with where it comes from ("RJ Asha", "Club FM", "Midas Network office"). */
  async reply(listenerId: string, commentId: string, view: TeamView, input: { body?: unknown }) {
    const text = body(input.body);
    return this.dataSource.transaction(async (m) => {
      const scope = await teamScope(m, listenerId, view);
      if (!scope.canEdit) throw new ForbiddenException('Your designation can read comments but not reply (it needs Programmes: edit).');
      const [c] = await m.query(
        `SELECT c.id FROM programme_comments c JOIN programmes p ON p.id = c."programmeId" WHERE c.id = $${scope.params.length + 1} AND ${scope.where}`,
        [...scope.params, commentId],
      );
      if (!c) throw new NotFoundException('Comment not found.');
      const [{ n }] = await m.query(`SELECT count(*)::int AS n FROM programme_comment_replies WHERE "commentId" = $1`, [commentId]);
      if (n >= 20) throw new ForbiddenException('This conversation is long enough. Talk to the listener on air or by phone instead.');
      const [row] = await m.query(
        `INSERT INTO programme_comment_replies ("commentId", "listenerId", "asLabel", body) VALUES ($1, $2, $3, $4) RETURNING id, "asLabel", body, "createdAt"`,
        [commentId, listenerId, scope.label.slice(0, 160), text],
      );
      await m.query(`UPDATE programme_comments SET "seenAt" = COALESCE("seenAt", now()) WHERE id = $1`, [commentId]);
      return row;
    });
  }
}

function signedIn(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}

/**
 * GET  programmes/:id/comments/mine     my comments and the replies
 * POST programmes/:id/comments          { body }
 * GET  comments/unread                  unread replies for me
 * GET  comments/team?as=…               the team's inbox
 * POST comments/:id/replies?as=…        { body }
 */
@Controller()
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  @Get('programmes/:id/comments/mine')
  mine(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.mine(signedIn(req), id);
  }

  @Post('programmes/:id/comments')
  create(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() input: { body?: unknown }) {
    const listenerId = signedIn(req);
    limit(req, 'comment', 30, HOUR);
    return this.service.create(listenerId, id, input ?? {});
  }

  @Get('comments/unread')
  unread(@Req() req: Request) {
    return this.service.unread(signedIn(req));
  }

  @Get('comments/team')
  team(@Req() req: Request, @Query() query: { as?: string; stationId?: string; organisationId?: string }) {
    return this.service.forTeam(signedIn(req), readTeamView(query));
  }

  @Post('comments/:id/replies')
  reply(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: { as?: string; stationId?: string; organisationId?: string },
    @Body() input: { body?: unknown },
  ) {
    return this.service.reply(signedIn(req), id, readTeamView(query), input ?? {});
  }
}

@Module({ controllers: [CommentsController], providers: [CommentsService] })
export class CommentsModule {}
