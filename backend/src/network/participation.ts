import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { decryptText, encryptText, lookupHash } from '../crypto/field-crypto';
import { VISIBLE_PROGRAMME } from '../orgs/visibility';
import { writeAudit } from '../onboarding/helpers';
import { CONTACT_RULE_MESSAGE, hasContactDetails } from '../shows/text-rules';
import { limit, HOUR } from '../rate-limit';
import { canManageProgramme, GUEST_CLOSES_BEFORE_MS } from '../guests/guest-rules';
import {
  allows,
  MAX_OPEN_PER_PROGRAMME,
  MAX_PER_DAY,
  nextStatusAllowed,
  PHONE,
  PHONE_KEEP_DAYS,
} from './participation-rules';
import { readTeamView, teamScope, type TeamView } from './team';

export type ParticipationInput = {
  kind?: unknown;
  note?: unknown;
  contactPhone?: unknown;
  nomineeName?: unknown;
  nomineePhone?: unknown;
};

function text(value: unknown, max: number, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new BadRequestException(`${label} must be text.`);
  const t = value.trim().replace(/\s+/g, ' ');
  if (t.length > max) throw new BadRequestException(`${label} is too long (${max} characters at most).`);
  return t || null;
}

function phone(value: unknown, label: string, required: boolean): string | null {
  const t = typeof value === 'string' ? value.trim() : '';
  if (!t) {
    if (required) throw new BadRequestException(`Enter ${label}.`);
    return null;
  }
  if (!PHONE.test(t)) throw new BadRequestException(`${label[0].toUpperCase()}${label.slice(1)} must be 6 to 19 digits, optionally starting with +.`);
  return t;
}

const digits = (p: string) => p.replace(/\D/g, '').slice(-10);
const OPEN = `('new', 'contacted', 'agreed')`;

/**
 * Listeners asking to take part in a programme (or a guest recording), or
 * nominating someone else (a friend for a prank call, say). Phone numbers
 * are encrypted, shown only to the programme team, and cleared after
 * PHONE_KEEP_DAYS. A nomination is aired only after the team marks that the
 * person agreed.
 */
@Injectable()
export class ParticipationService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    // Clear old phone numbers every hour (and once shortly after start).
    this.timer = setInterval(() => void this.clearOldPhones().catch(() => undefined), HOUR);
    this.timer.unref();
    setTimeout(() => void this.clearOldPhones().catch(() => undefined), 60_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Phone numbers go after 30 days. A declined nominee's keyed hash stays, so they are not nominated again for that programme. */
  async clearOldPhones(now = new Date()) {
    await this.dataSource.query(
      `UPDATE participations
          SET "contactPhone" = NULL, "nomineePhone" = NULL,
              "nomineePhoneHash" = CASE WHEN status = 'declined' THEN "nomineePhoneHash" ELSE NULL END,
              "phonesClearedAt" = $1
        WHERE "phonesClearedAt" IS NULL AND "createdAt" < $1::timestamptz - make_interval(days => $2)`,
      [now, PHONE_KEEP_DAYS],
    );
  }

  // ---------------------------------------------------------------- listeners

  /** What a programme invites, and the signed-in listener's own requests to it. */
  async forListener(listenerId: string | null, programmeId: string) {
    const [p] = await this.dataSource.query(
      `SELECT p.id, p.participation, p."participationPrompt" FROM programmes p WHERE p.id = $1 AND p."isActive" AND ${VISIBLE_PROGRAMME()}`,
      [programmeId],
    );
    if (!p) throw new NotFoundException('Programme not found.');
    const mine = listenerId
      ? await this.dataSource.query(
          `SELECT id, kind, note, "nomineeName", status, "guestSessionId", "createdAt"
             FROM participations WHERE "programmeId" = $1 AND "listenerId" = $2 ORDER BY "createdAt" DESC LIMIT 20`,
          [programmeId, listenerId],
        )
      : [];
    return { mode: p.participation, prompt: p.participationPrompt, mine };
  }

  async create(listenerId: string, programmeId: string, input: ParticipationInput, guestSessionId: string | null = null, now = new Date()) {
    const kind = guestSessionId ? 'take_part' : input.kind;
    if (kind !== 'take_part' && kind !== 'nominate') throw new BadRequestException('Choose to take part yourself or nominate someone.');
    const note = text(input.note, 300, kind === 'nominate' ? 'Why them' : 'About you');
    const nomineeName = kind === 'nominate' ? text(input.nomineeName, 100, 'Their name') : null;
    if (kind === 'nominate' && !nomineeName) throw new BadRequestException('Enter the name of the person you are nominating.');
    for (const t of [note, nomineeName]) if (t && hasContactDetails(t)) throw new BadRequestException(CONTACT_RULE_MESSAGE);
    const contactPhone = phone(input.contactPhone, 'your phone number', kind === 'take_part');
    const nomineePhone = kind === 'nominate' ? phone(input.nomineePhone, 'their phone number', true) : null;
    if (nomineePhone && contactPhone && digits(nomineePhone) === digits(contactPhone)) {
      throw new BadRequestException('To take part yourself, choose "Take part" instead of nominating.');
    }
    const nomineePhoneHash = nomineePhone ? lookupHash(digits(nomineePhone)) : null;

    return this.dataSource.transaction(async (m) => {
      // One listener's requests are counted in order.
      await m.query(`SELECT pg_advisory_xact_lock(hashtext('participation:' || $1))`, [listenerId]);
      const [p] = await m.query(
        `SELECT p.id, p.participation FROM programmes p WHERE p.id = $1 AND p."isActive" AND ${VISIBLE_PROGRAMME()}`,
        [programmeId],
      );
      if (!p) throw new NotFoundException('Programme not found.');
      if (guestSessionId) {
        const [g] = await m.query(`SELECT status, "recordingAt" FROM guest_sessions WHERE id = $1 AND "programmeId" = $2`, [guestSessionId, programmeId]);
        if (!g || g.status !== 'scheduled') throw new NotFoundException('Guest session not found.');
        if (new Date(g.recordingAt).getTime() - now.getTime() <= GUEST_CLOSES_BEFORE_MS) {
          throw new ForbiddenException('Requests to take part close 2 hours before the recording.');
        }
      } else if (!allows(p.participation, kind)) {
        throw new ForbiddenException(kind === 'nominate' ? 'This programme is not taking nominations.' : 'This programme is not inviting listeners to take part.');
      }
      const [{ open }] = await m.query(
        `SELECT count(*)::int AS open FROM participations WHERE "listenerId" = $1 AND "programmeId" = $2 AND status IN ${OPEN}`,
        [listenerId, programmeId],
      );
      if (open >= MAX_OPEN_PER_PROGRAMME) {
        throw new ForbiddenException(`You already have ${MAX_OPEN_PER_PROGRAMME} requests waiting with this programme. Wait for the team to reply.`);
      }
      const [{ today }] = await m.query(
        `SELECT count(*)::int AS today FROM participations WHERE "listenerId" = $1 AND "createdAt" > $2::timestamptz - interval '1 day'`,
        [listenerId, now],
      );
      if (today >= MAX_PER_DAY) throw new ForbiddenException('You have sent a lot of requests today. Please try again tomorrow.');
      if (guestSessionId) {
        const [dup] = await m.query(`SELECT 1 FROM participations WHERE "listenerId" = $1 AND "guestSessionId" = $2`, [listenerId, guestSessionId]);
        if (dup) throw new BadRequestException('You have already asked to take part in this recording.');
      }
      if (nomineePhoneHash) {
        const [seen] = await m.query(
          `SELECT status FROM participations
            WHERE "programmeId" = $1 AND "nomineePhoneHash" = $2 AND status IN ('new', 'contacted', 'agreed', 'declined')
            LIMIT 1`,
          [programmeId, nomineePhoneHash],
        );
        if (seen) {
          throw new BadRequestException(
            seen.status === 'declined'
              ? 'This person cannot be nominated for this programme.'
              : 'Someone has already nominated this person. The team will be in touch with them.',
          );
        }
      }
      const [row] = await m.query(
        `INSERT INTO participations ("programmeId", "guestSessionId", "listenerId", kind, note, "contactPhone", "nomineeName", "nomineePhone", "nomineePhoneHash")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, kind, status, "createdAt"`,
        [programmeId, guestSessionId, listenerId, kind, note, encryptText(contactPhone), nomineeName, encryptText(nomineePhone), nomineePhoneHash],
      );
      return { ...row, note, nomineeName };
    });
  }

  async takePartInGuestSession(listenerId: string, sessionId: string, input: ParticipationInput) {
    const [g] = await this.dataSource.query(`SELECT "programmeId" FROM guest_sessions WHERE id = $1`, [sessionId]);
    if (!g) throw new NotFoundException('Guest session not found.');
    return this.create(listenerId, g.programmeId, { ...input, kind: 'take_part' }, sessionId);
  }

  // --------------------------------------------------------------------- team

  /** Requests for the programmes this person handles, newest first, with phones only for those who may act. */
  async forTeam(listenerId: string, view: TeamView) {
    const m = this.dataSource.manager;
    const scope = await teamScope(m, listenerId, view);
    const rows: {
      id: string; kind: string; note: string | null; contactPhone: string | null; nomineeName: string | null; nomineePhone: string | null;
      status: string; agreedAt: Date | null; createdAt: Date; phonesClearedAt: Date | null; listenerName: string | null;
      programmeId: string; programmeName: string; stationName: string | null; guestSessionId: string | null; guestName: string | null;
    }[] = await m.query(
      `SELECT x.id, x.kind, x.note, x."contactPhone", x."nomineeName", x."nomineePhone", x.status, x."agreedAt", x."createdAt",
              x."phonesClearedAt", l."displayName" AS "listenerName",
              p.id AS "programmeId", p.name AS "programmeName", s.name AS "stationName",
              x."guestSessionId", g."guestName"
         FROM participations x
         JOIN programmes p ON p.id = x."programmeId"
         LEFT JOIN stations s ON s.id = p."stationId"
         LEFT JOIN listeners l ON l.id = x."listenerId"
         LEFT JOIN guest_sessions g ON g.id = x."guestSessionId"
        WHERE ${scope.where} AND x."createdAt" > now() - interval '60 days'
        ORDER BY (x.status IN ${OPEN}) DESC, x."createdAt" DESC
        LIMIT 200`,
      scope.params,
    );
    return {
      canEdit: scope.canEdit,
      requests: rows.map((r) => ({
        ...r,
        contactPhone: scope.canEdit ? decryptText(r.contactPhone) : null,
        nomineePhone: scope.canEdit ? decryptText(r.nomineePhone) : null,
      })),
    };
  }

  async setStatus(listenerId: string, id: string, status: unknown) {
    if (typeof status !== 'string') throw new BadRequestException('Choose a status.');
    return this.dataSource.transaction(async (m) => {
      const [row] = await m.query(`SELECT id, kind, status, "agreedAt", "programmeId" FROM participations WHERE id = $1 FOR UPDATE`, [id]);
      if (!row) throw new NotFoundException('Request not found.');
      if (!(await canManageProgramme(m, listenerId, row.programmeId))) throw new ForbiddenException('Only the programme team can handle this request.');
      const problem = nextStatusAllowed(row.kind, row.status, status, row.agreedAt);
      if (problem) throw new BadRequestException(problem);
      const agreedAt = status === 'agreed' ? new Date() : status === 'new' || status === 'declined' ? null : row.agreedAt;
      await m.query(
        `UPDATE participations SET status = $2, "agreedAt" = $3, "handledByListenerId" = $4, "handledAt" = now() WHERE id = $1`,
        [id, status, agreedAt, listenerId],
      );
      if (row.kind === 'nominate' && (status === 'agreed' || status === 'declined')) {
        // The consent decision is kept in the audit log: who recorded it and when.
        await writeAudit(m, listenerId, `nomination.${status}`, 'participation', id, { programmeId: row.programmeId });
      }
      return { id, status, agreedAt };
    });
  }
}

function signedIn(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}

/**
 * GET   programmes/:id/participation           what it invites + my requests
 * POST  programmes/:id/participation           take part / nominate
 * POST  guest-sessions/:id/take-part           ask to take part in a guest recording
 * GET   participation/team?as=…                the team's inbox
 * PATCH participation/:id                      { status }
 */
@Controller()
export class ParticipationController {
  constructor(private readonly service: ParticipationService) {}

  @Get('programmes/:id/participation')
  mine(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    const user = req.isAuthenticated?.() ? (req.user as { id: string }) : null;
    return this.service.forListener(user?.id ?? null, id);
  }

  @Post('programmes/:id/participation')
  create(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: ParticipationInput) {
    const listenerId = signedIn(req);
    limit(req, 'participation', 20, HOUR);
    return this.service.create(listenerId, id, body ?? {});
  }

  @Post('guest-sessions/:id/take-part')
  takePart(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: ParticipationInput) {
    const listenerId = signedIn(req);
    limit(req, 'participation', 20, HOUR);
    return this.service.takePartInGuestSession(listenerId, id, body ?? {});
  }

  @Get('participation/team')
  team(@Req() req: Request, @Query() query: { as?: string; stationId?: string; organisationId?: string }) {
    return this.service.forTeam(signedIn(req), readTeamView(query));
  }

  @Patch('participation/:id')
  setStatus(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { status?: unknown }) {
    return this.service.setStatus(signedIn(req), id, body?.status);
  }
}

@Module({ controllers: [ParticipationController], providers: [ParticipationService] })
export class ParticipationModule {}
