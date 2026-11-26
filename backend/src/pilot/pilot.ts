import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { HOUR, limit } from '../rate-limit';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { assertStationAccess } from '../orgs/access';
import { signedInId } from '../device';
import { recordStep } from './steps';

const FUNNEL = ['open', 'tap', 'signin_prompt', 'signin', 'message'] as const;
const DAYS = [7, 14, 30, 90];

/**
 * Pilot numbers: where people drop off, how many come back within 7 days,
 * and interactions per listener. All of NowRJ for the Super Admin; one
 * station for its staff.
 */
@Injectable()
export class PilotService {
  constructor(readonly dataSource: DataSource) {}

  async numbers(stationId: string | null, daysInput: unknown) {
    const days = DAYS.includes(Number(daysInput)) ? Number(daysInput) : 30;
    const q = <T>(sql: string, params: unknown[]) => this.dataSource.query(sql, params) as Promise<T[]>;
    // $1 = first day, $2 = station (or null for all)
    const [{ from, today }] = await q<{ from: string; today: string }>(
      `SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date - ($1::int - 1))::text AS from,
              (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today`,
      [days],
    );
    const station = `($2::uuid IS NULL OR s."stationId" = $2)`;

    const funnelRows = await q<{ step: string; people: number }>(
      `SELECT step, count(DISTINCT person)::int AS people FROM pilot_steps s
        WHERE day >= $1::date AND ${station} GROUP BY step`,
      [from, stationId],
    );
    const funnel = FUNNEL
      // Opening NowRJ and being asked to sign in are not tied to one station.
      .filter((step) => !stationId || (step !== 'open' && step !== 'signin_prompt'))
      .map((step) => ({ step, people: funnelRows.find((r) => r.step === step)?.people ?? 0 }));

    // People first seen in the period (and at least 7 days ago), and how many came back within 7 days.
    const [returns] = await q<{ cohort: number; returned: number }>(
      `WITH act AS (SELECT DISTINCT person, day FROM pilot_steps s WHERE ${station}),
            first AS (SELECT person, min(day) AS d0 FROM act GROUP BY person)
       SELECT count(*)::int AS cohort,
              count(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM act a WHERE a.person = f.person AND a.day > f.d0 AND a.day <= f.d0 + 7))::int AS returned
         FROM first f
        WHERE f.d0 >= $1::date AND f.d0 <= (now() AT TIME ZONE 'Asia/Kolkata')::date - 7`,
      [from, stationId],
    );

    // Interactions from the real tables: likes/fire, poll votes, messages, call taps.
    const showStation = (alias: string) => `($2::uuid IS NULL OR ${alias}."stationId" = $2)`;
    const since = `(($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata')`;
    const [inter] = await q<{ reactions: number; votes: number; messages: number; callTaps: number; people: number }>(
      `WITH i AS (
         SELECT 'reaction' AS kind, coalesce(x."listenerId"::text, x."deviceId"::text) AS who FROM reactions x
           JOIN show_occurrences o ON o.id = x."showOccurrenceId" WHERE x."createdAt" >= ${since} AND ${showStation('o')}
         UNION ALL
         SELECT 'vote', coalesce(v."listenerId"::text, v."deviceId"::text) FROM poll_votes v
           JOIN polls p ON p.id = v."pollId" JOIN show_occurrences o ON o.id = p."showOccurrenceId"
          WHERE v."createdAt" >= ${since} AND ${showStation('o')}
         UNION ALL
         SELECT 'message', r."listenerId"::text FROM song_requests r
           JOIN show_occurrences o ON o.id = r."showOccurrenceId" WHERE r."createdAt" >= ${since} AND ${showStation('o')}
         UNION ALL
         SELECT 'call', coalesce(e."listenerId"::text, e."deviceId"::text) FROM engagement_events e
           JOIN show_occurrences o ON o.id = e."showOccurrenceId"
          WHERE e.type = 'call_tap' AND e."createdAt" >= ${since} AND ${showStation('o')})
       SELECT count(*) FILTER (WHERE kind = 'reaction')::int AS reactions,
              count(*) FILTER (WHERE kind = 'vote')::int AS votes,
              count(*) FILTER (WHERE kind = 'message')::int AS messages,
              count(*) FILTER (WHERE kind = 'call')::int AS "callTaps",
              count(DISTINCT who)::int AS people
         FROM i`,
      [from, stationId],
    );
    const total = inter.reactions + inter.votes + inter.messages + inter.callTaps;

    // Sharing: people who shared a NowRJ link, and people who arrived from one.
    const [sharing] = await q<{ shared: number; arrived: number }>(
      `SELECT count(DISTINCT person) FILTER (WHERE step = 'share')::int AS shared,
              count(DISTINCT person) FILTER (WHERE step = 'share_open')::int AS arrived
         FROM pilot_steps s WHERE day >= $1::date AND step IN ('share', 'share_open') AND ${station}`,
      [from, stationId],
    );

    const daily = await q<{ day: string; opened: number; tapped: number }>(
      `SELECT d::date::text AS day,
              (SELECT count(DISTINCT person)::int FROM pilot_steps s WHERE s.day = d::date AND s.step = 'open' AND ${station}) AS opened,
              (SELECT count(DISTINCT person)::int FROM pilot_steps s WHERE s.day = d::date AND s.step NOT IN ('open', 'share_open') AND ${station}) AS tapped
         FROM generate_series($1::date, (now() AT TIME ZONE 'Asia/Kolkata')::date, interval '1 day') d
        ORDER BY d`,
      [from, stationId],
    );

    return {
      days,
      from,
      to: today,
      funnel,
      returns: { ...returns, percent: returns.cohort ? Math.round((returns.returned / returns.cohort) * 100) : null },
      sharing,
      interactions: { ...inter, total, perPerson: inter.people ? Math.round((total / inter.people) * 10) / 10 : null },
      daily,
    };
  }
}

@Controller()
export class PilotController {
  constructor(private readonly pilot: PilotService) {}

  /** Steps the page reports: opening NowRJ, being asked to sign in, opening an ad, sharing a link, arriving from one. */
  @Post('pulse')
  async pulse(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { step?: unknown; showId?: unknown; adId?: unknown; programmeId?: unknown; path?: unknown },
  ) {
    const step = body?.step;
    if (step !== 'open' && step !== 'signin_prompt' && step !== 'ad_open' && step !== 'share' && step !== 'share_open') {
      throw new BadRequestException('Unknown step.');
    }
    limit(req, 'pulse', 600, HOUR);
    await recordStep(this.pilot.dataSource.manager, req, step, {
      showId: body.showId,
      adId: body.adId,
      programmeId: body.programmeId,
      path: body.path,
      res,
    });
    return { ok: true };
  }

  @Get('admin/pilot')
  @UseGuards(SuperadminGuard)
  all(@Query('days') days?: string, @Query('stationId') stationId?: string) {
    const station = stationId && /^[0-9a-f-]{36}$/i.test(stationId) ? stationId : null;
    return this.pilot.numbers(station, days);
  }

  @Get('stations/:stationId/pilot')
  async station(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Query('days') days?: string) {
    const listenerId = signedInId(req);
    if (!listenerId) throw new UnauthorizedException('Please sign in first.');
    await assertStationAccess(this.pilot.dataSource.manager, listenerId, stationId, 'stats', 'view');
    return this.pilot.numbers(stationId, days);
  }
}

@Module({ controllers: [PilotController], providers: [PilotService] })
export class PilotModule {}
