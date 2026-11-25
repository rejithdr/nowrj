import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { ensureDeviceId, signedInId } from '../device';
import { writeAudit } from '../onboarding/helpers';
import { CONTACT_RULE_MESSAGE, hasContactDetails } from '../shows/text-rules';

const TARGETS = ['programme', 'rj', 'ad'] as const;
const REASONS = ['wrong_info', 'offensive', 'spam', 'unsafe', 'other'] as const;
type Target = (typeof TARGETS)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PER_DAY = 10;

@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  /** The thing exists and is showing; returns its name for the admin list. */
  private async target(type: Target, id: string) {
    const sql = {
      programme: `SELECT p.name, s.name AS "stationName" FROM programmes p LEFT JOIN stations s ON s.id = p."stationId" WHERE p.id = $1`,
      rj: `SELECT r.name, s.name AS "stationName" FROM rjs r LEFT JOIN stations s ON s.id = r."stationId" WHERE r.id = $1`,
      ad: `SELECT c.title AS name, s.name AS "stationName" FROM ads a JOIN ad_creatives c ON c.id = a."creativeId" JOIN stations s ON s.id = a."stationId" WHERE a.id = $1`,
    }[type];
    const [row] = await this.dataSource.query(sql, [id]);
    return row as { name: string; stationName: string | null } | undefined;
  }

  async create(listenerId: string | null, deviceId: string, body: Record<string, unknown>) {
    const type = body?.targetType as Target;
    const id = body?.targetId;
    const reason = body?.reason;
    if (!TARGETS.includes(type) || typeof id !== 'string' || !UUID.test(id)) throw new BadRequestException('Unknown item to report.');
    if (!REASONS.includes(reason as (typeof REASONS)[number])) throw new BadRequestException('Choose a reason.');
    const details = typeof body?.details === 'string' ? body.details.trim().slice(0, 300) || null : null;
    if (details && hasContactDetails(details)) throw new BadRequestException(CONTACT_RULE_MESSAGE);
    if (!(await this.target(type, id))) throw new NotFoundException('That item no longer exists.');
    const showId = typeof body?.showId === 'string' && UUID.test(body.showId) ? body.showId : null;
    const reporter = listenerId ?? deviceId;

    const [{ today }] = await this.dataSource.query(
      `SELECT count(*)::int AS today FROM reports WHERE reporter = $1 AND "createdAt" > now() - interval '1 day'`,
      [reporter],
    );
    if (today >= PER_DAY) throw new HttpException('You have sent a lot of reports today. Please try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);

    const [row] = await this.dataSource.query(
      `INSERT INTO reports ("targetType", "targetId", "showOccurrenceId", reason, details, reporter, "listenerId", "deviceId")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING RETURNING id`,
      [type, id, showId, reason, details, reporter, listenerId, listenerId ? null : deviceId],
    );
    return { ok: true, alreadyReported: !row };
  }

  /** Open reports grouped by what was reported, most reported first. */
  async open() {
    const rows: { targetType: Target; targetId: string; count: number; reasons: string[]; details: string[]; firstAt: Date; lastAt: Date }[] =
      await this.dataSource.query(
        `SELECT "targetType", "targetId", count(*)::int AS count,
                array_agg(DISTINCT reason) AS reasons,
                array_remove(array_agg(details ORDER BY "createdAt" DESC), NULL) AS details,
                min("createdAt") AS "firstAt", max("createdAt") AS "lastAt"
           FROM reports WHERE status = 'open'
          GROUP BY "targetType", "targetId"
          ORDER BY count(*) DESC, max("createdAt") DESC
          LIMIT 200`,
      );
    const result = [];
    for (const r of rows) {
      const t = await this.target(r.targetType, r.targetId);
      result.push({ ...r, details: r.details.slice(0, 5), name: t?.name ?? '(removed)', stationName: t?.stationName ?? null });
    }
    return result;
  }

  /** Dismiss all open reports about a thing, or hide the thing and close them. */
  async handle(adminId: string, type: string, id: string, action: unknown) {
    if (!TARGETS.includes(type as Target)) throw new BadRequestException('Unknown item.');
    if (action !== 'dismiss' && action !== 'hide') throw new BadRequestException('Choose dismiss or hide.');
    return this.dataSource.transaction(async (m) => {
      if (action === 'hide') {
        const sql = {
          programme: `UPDATE programmes SET "isActive" = false WHERE id = $1`,
          rj: `UPDATE rjs SET "isActive" = false WHERE id = $1`,
          ad: `UPDATE ads SET status = 'withdrawn', "updatedAt" = now() WHERE id = $1 AND status <> 'withdrawn'`,
        }[type as Target];
        await m.query(sql, [id]);
      }
      const closed = await m.query(
        `UPDATE reports SET status = $3, "handledByListenerId" = $4, "handledAt" = now()
          WHERE "targetType" = $1 AND "targetId" = $2 AND status = 'open' RETURNING id`,
        [type, id, action === 'hide' ? 'hidden' : 'dismissed', adminId],
      );
      await writeAudit(m, adminId, action === 'hide' ? 'report.hidden' : 'report.dismissed', type, id, { reports: closed.length });
      return { ok: true, closed: closed.length };
    });
  }
}

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Anyone can report; signed-out reports are tied to the phone's device id. */
  @Post('reports')
  create(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: Record<string, unknown>) {
    return this.reports.create(signedInId(req), ensureDeviceId(req, res), body ?? {});
  }

  @Get('admin/reports')
  @UseGuards(SuperadminGuard)
  open() {
    return this.reports.open();
  }

  @Patch('admin/reports/:type/:id')
  @UseGuards(SuperadminGuard)
  handle(
    @Req() req: Request,
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { action?: unknown },
  ) {
    return this.reports.handle(signedInId(req)!, type, id, body?.action);
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
