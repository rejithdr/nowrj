import { ShowsService } from '../shows/shows.service';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DataSource, EntityManager } from 'typeorm';
import { clean, writeAudit } from '../onboarding/helpers';
import { stationAccess } from '../orgs/access';
import { meets } from '../orgs/access-rules';
import type { Level } from '../orgs/entities';
import { todayInIndia } from '../rjs/dates';
import { MAX_SPONSORED_PER_SHOW, RUNNABLE_AD } from './placement';
export { adsForShows, MAX_SPONSORED_PER_SHOW, RUNNABLE_AD } from './placement';

export type AdKind = 'sponsored' | 'shoutout' | 'aired';
const AREA: Record<AdKind, 'adsSponsored' | 'adsShoutout' | 'adsAired'> = {
  sponsored: 'adsSponsored',
  shoutout: 'adsShoutout',
  aired: 'adsAired',
};
const KIND_LABEL: Record<AdKind, string> = { sponsored: 'Sponsored', shoutout: 'RJ shout-out', aired: 'Aired spot' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOUR = 3600 * 1000;

function listenerId(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}

/** The calendar month in India, as YYYY-MM. */
export function indiaMonth(now = new Date()) {
  return todayInIndia(now).slice(0, 7);
}

export type NewAd = {
  advertiserId?: string;
  creativeId?: string;
  kind?: string;
  programmeId?: string | null;
  showOccurrenceId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

@Injectable()
export class AdsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly shows: ShowsService,
  ) {}

  private async access(m: EntityManager, listenerId: string, stationId: string) {
    const [station] = await m.query(`SELECT id, name, "adsEnabled" FROM stations WHERE id = $1`, [stationId]);
    if (!station) throw new NotFoundException('Station not found.');
    if (!station.adsEnabled) throw new ForbiddenException('Ads are not switched on for this station yet.');
    const access = await stationAccess(m, listenerId, stationId);
    if (!access) throw new ForbiddenException('You are not staff at this station.');
    return access;
  }

  private need(access: { levels: Record<string, Level> }, kind: AdKind, level: Level) {
    if (!meets(access.levels[AREA[kind]], level)) {
      throw new ForbiddenException(`Your designation does not allow this for ${KIND_LABEL[kind]} ads (needs ${level}).`);
    }
  }

  // ------------------------------------------------------------- staff side

  /** Every ad at the station, newest first, with what this person may do. */
  async list(listenerId: string, stationId: string, now = new Date()) {
    const m = this.dataSource.manager;
    const access = await this.access(m, listenerId, stationId);
    const can = (kind: AdKind, level: Level) => meets(access.levels[AREA[kind]], level);
    if (!(['sponsored', 'shoutout', 'aired'] as AdKind[]).some((k) => can(k, 'view'))) {
      throw new ForbiddenException('Your designation does not include ads.');
    }
    const rows: Record<string, unknown>[] = await m.query(
      `SELECT a.id, a.kind, a.status, a."startDate"::text AS "startDate", a."endDate"::text AS "endDate", a."rejectReason",
              a."activatedAt", a."makerListenerId", a."createdAt", a."checkedAt",
              adv."businessName", c.title AS "creativeTitle",
              p.name AS "programmeName",
              o."startsAt" AS "showStartsAt", o."endsAt" AS "showEndsAt", op.name AS "showProgrammeName",
              mk."displayName" AS "makerName", ck."displayName" AS "checkerName",
              (SELECT count(*)::int FROM ad_responses r WHERE r."adId" = a.id) AS responses,
              (SELECT count(*)::int FROM ad_responses r WHERE r."adId" = a.id AND r.kind = 'call') AS calls,
              (${RUNNABLE_AD('a')}) AS runnable,
              EXISTS (SELECT 1 FROM advertiser_consents ac WHERE ac."advertiserId" = a."advertiserId" AND ac.status = 'valid') AS "hasConsent"
         FROM ads a
         JOIN advertisers adv ON adv.id = a."advertiserId"
         JOIN ad_creatives c ON c.id = a."creativeId"
         LEFT JOIN programmes p ON p.id = a."programmeId"
         LEFT JOIN show_occurrences o ON o.id = a."showOccurrenceId"
         LEFT JOIN programmes op ON op.id = o."programmeId"
         LEFT JOIN listeners mk ON mk.id = a."makerListenerId"
         LEFT JOIN listeners ck ON ck.id = a."checkerListenerId"
        WHERE a."stationId" = $1
        ORDER BY (a.status = 'pending') DESC, a."createdAt" DESC
        LIMIT 200`,
      [stationId],
    );
    return {
      can: Object.fromEntries((['sponsored', 'shoutout', 'aired'] as AdKind[]).map((k) => [k, { view: can(k, 'view'), edit: can(k, 'edit'), authorise: can(k, 'authorise') }])),
      ads: rows
        .filter((r) => can(r.kind as AdKind, 'view'))
        .map((r) => {
          const kind = r.kind as AdKind;
          const live = r.showStartsAt && new Date(r.showStartsAt as string) <= now && now < new Date(r.showEndsAt as string);
          return {
            ...r,
            mine: r.makerListenerId === listenerId,
            canApprove: r.status === 'pending' && can(kind, 'authorise') && r.makerListenerId !== listenerId,
            canWithdraw: (r.status === 'pending' || r.status === 'approved') && can(kind, 'edit'),
            canPutOnAir: kind === 'shoutout' && r.status === 'approved' && Boolean(live) && can(kind, 'edit'),
          };
        }),
    };
  }

  /** Programmes airing on the station and its shows in the next 7 days, for the ad form. */
  async targets(listenerId: string, stationId: string, now = new Date()) {
    const m = this.dataSource.manager;
    await this.access(m, listenerId, stationId);
    await this.shows.refreshShows(now);
    const programmes = await m.query(
      `SELECT id, name FROM programmes WHERE "stationId" = $1 AND "isActive" ORDER BY name`,
      [stationId],
    );
    const shows = await m.query(
      `SELECT o.id, o."startsAt", o."endsAt", p.name AS "programmeName"
         FROM show_occurrences o JOIN programmes p ON p.id = o."programmeId"
        WHERE o."stationId" = $1 AND o.status = 'scheduled' AND o."endsAt" > $2 AND o."startsAt" < $3
        ORDER BY o."startsAt"`,
      [stationId, now, new Date(now.getTime() + 7 * 24 * HOUR)],
    );
    return { programmes, shows, today: todayInIndia(now) };
  }

  async create(listenerId: string, stationId: string, input: NewAd, now = new Date()) {
    const kind = input?.kind as AdKind;
    if (!AREA[kind]) throw new BadRequestException('Choose the kind of ad.');
    const id = (v: unknown, label: string) => {
      if (typeof v !== 'string' || !UUID.test(v)) throw new BadRequestException(`Choose ${label}.`);
      return v;
    };
    return this.dataSource.transaction(async (m) => {
      const access = await this.access(m, listenerId, stationId);
      this.need(access, kind, 'edit');
      const advertiserId = id(input.advertiserId, 'the advertiser');
      const creativeId = id(input.creativeId, 'a creative from the library');
      const [creative] = await m.query(
        `SELECT 1 FROM ad_creatives c JOIN advertiser_stations l ON l."advertiserId" = c."advertiserId" AND l."stationId" = c."stationId"
          WHERE c.id = $1 AND c."advertiserId" = $2 AND c."stationId" = $3 AND c.status = 'active' AND l.status <> 'ended'`,
        [creativeId, advertiserId, stationId],
      );
      if (!creative) throw new BadRequestException('Choose a creative from this advertiser\'s library at your station.');

      let programmeId: string | null = null;
      let showOccurrenceId: string | null = null;
      let startDate: string | null = null;
      let endDate: string | null = null;
      const byShow = kind === 'shoutout' || (kind === 'aired' && input.showOccurrenceId);
      if (byShow) {
        showOccurrenceId = id(input.showOccurrenceId, 'the show');
        const [show] = await m.query(`SELECT "endsAt" FROM show_occurrences WHERE id = $1 AND "stationId" = $2 AND status = 'scheduled'`, [
          showOccurrenceId,
          stationId,
        ]);
        if (!show) throw new BadRequestException('Choose a show on your station.');
        if (new Date(show.endsAt) <= now) throw new BadRequestException('That show has already ended.');
      } else {
        programmeId = id(input.programmeId, 'the programme');
        const [programme] = await m.query(`SELECT 1 FROM programmes WHERE id = $1 AND "stationId" = $2`, [programmeId, stationId]);
        if (!programme) throw new BadRequestException('Choose a programme that airs on your station.');
        startDate = typeof input.startDate === 'string' && DATE.test(input.startDate) ? input.startDate : null;
        endDate = typeof input.endDate === 'string' && DATE.test(input.endDate) ? input.endDate : null;
        if (!startDate || !endDate) throw new BadRequestException('Choose the first and last date.');
        if (endDate < startDate) throw new BadRequestException('The last date must be on or after the first date.');
        if (endDate < todayInIndia(now)) throw new BadRequestException('Those dates have already passed.');
        if ((Date.parse(endDate) - Date.parse(startDate)) / (24 * HOUR) > 366) throw new BadRequestException('Keep it to a year at most.');
      }
      const [ad] = await m.query(
        `INSERT INTO ads ("stationId", "advertiserId", "creativeId", kind, "programmeId", "showOccurrenceId", "startDate", "endDate", "makerListenerId")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [stationId, advertiserId, creativeId, kind, programmeId, showOccurrenceId, startDate, endDate, listenerId],
      );
      await writeAudit(m, listenerId, 'ad.created', 'ad', ad.id, { stationId, kind, advertiserId, programmeId, showOccurrenceId, startDate, endDate });
      return { id: ad.id, status: 'pending' };
    });
  }

  private async adAt(m: EntityManager, adId: string, stationId: string) {
    const [ad] = await m.query(`SELECT * FROM ads WHERE id = $1 AND "stationId" = $2 FOR UPDATE`, [adId, stationId]);
    if (!ad) throw new NotFoundException('Ad not found at your station.');
    return ad;
  }

  /** Maker-checker: always someone other than the person who entered the ad. */
  async decide(listenerId: string, stationId: string, adId: string, approve: boolean, reasonInput: unknown, now = new Date()) {
    const reason = clean(reasonInput);
    if (!approve && !reason) throw new BadRequestException('Give a reason so the person who entered it knows what to change.');
    return this.dataSource.transaction(async (m) => {
      const access = await this.access(m, listenerId, stationId);
      const ad = await this.adAt(m, adId, stationId);
      this.need(access, ad.kind, 'authorise');
      if (ad.status !== 'pending') throw new ConflictException('This ad has already been decided.');
      if (ad.makerListenerId === listenerId) throw new ForbiddenException('Someone else must approve an ad you entered.');
      if (approve && ad.kind === 'sponsored') {
        const [{ n }] = await m.query(
          `SELECT count(*)::int AS n FROM ads WHERE "programmeId" = $1 AND kind = 'sponsored' AND status = 'approved'
              AND "startDate" <= $3 AND "endDate" >= $2`,
          [ad.programmeId, ad.startDate, ad.endDate],
        );
        if (n >= MAX_SPONSORED_PER_SHOW) {
          throw new ConflictException(`This programme already has ${MAX_SPONSORED_PER_SHOW} sponsored ads on some of these dates. Withdraw one or change the dates.`);
        }
      }
      await m.query(
        `UPDATE ads SET status = $2, "checkerListenerId" = $3, "checkedAt" = $4, "rejectReason" = $5, "updatedAt" = $4 WHERE id = $1`,
        [adId, approve ? 'approved' : 'rejected', listenerId, now, approve ? null : reason?.slice(0, 300)],
      );
      await writeAudit(m, listenerId, approve ? 'ad.approved' : 'ad.rejected', 'ad', adId, { stationId, reason });
      return { id: adId, status: approve ? 'approved' : 'rejected' };
    });
  }

  async withdraw(listenerId: string, stationId: string, adId: string, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const access = await this.access(m, listenerId, stationId);
      const ad = await this.adAt(m, adId, stationId);
      this.need(access, ad.kind, 'edit');
      if (ad.status !== 'pending' && ad.status !== 'approved') throw new ConflictException('This ad is not running.');
      await m.query(`UPDATE ads SET status = 'withdrawn', "updatedAt" = $2 WHERE id = $1`, [adId, now]);
      await writeAudit(m, listenerId, 'ad.withdrawn', 'ad', adId, { stationId });
      return { id: adId, status: 'withdrawn' };
    });
  }

  /**
   * Decision 6: the show's RJ, or station staff with Edit on Shout-out, put
   * an approved shout-out on air while the show is live.
   */
  async putOnAir(listenerId: string, adId: string, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const [ad] = await m.query(
        `SELECT a.*, o."startsAt", o."endsAt" FROM ads a JOIN show_occurrences o ON o.id = a."showOccurrenceId" WHERE a.id = $1 FOR UPDATE OF a`,
        [adId],
      );
      if (!ad || ad.kind !== 'shoutout') throw new NotFoundException('Shout-out not found.');
      if (ad.status !== 'approved') throw new ConflictException('This shout-out has not been approved.');
      if (!(new Date(ad.startsAt) <= now && now < new Date(ad.endsAt))) throw new ConflictException('A shout-out can go on air only while its show is live.');
      const [host] = await m.query(
        `SELECT 1 FROM show_occurrence_hosts h JOIN rjs r ON r.id = h."rjId" WHERE h."occurrenceId" = $1 AND r."ownerListenerId" = $2`,
        [ad.showOccurrenceId, listenerId],
      );
      if (!host) {
        const access = await stationAccess(m, listenerId, ad.stationId);
        if (!access || !meets(access.levels.adsShoutout, 'edit')) {
          throw new ForbiddenException('Only the show\'s RJ, or station staff with Edit on Shout-out, can put it on air.');
        }
      }
      await m.query(`UPDATE ads SET "activatedAt" = $2, "activatedByListenerId" = $3, "updatedAt" = $2 WHERE id = $1`, [adId, now, listenerId]);
      await writeAudit(m, listenerId, 'ad.shoutout_on_air', 'ad', adId, { stationId: ad.stationId, showOccurrenceId: ad.showOccurrenceId });
      return { id: adId, activatedAt: now };
    });
  }

  /** Approved shout-outs for the RJ's shows that are live or coming up today. */
  async rjShoutouts(listenerId: string, now = new Date()) {
    return this.dataSource.query(
      `SELECT a.id, a."activatedAt", adv."businessName", c.title, c."offerText", o.id AS "showId", o."startsAt", o."endsAt", p.name AS "programmeName",
              (o."startsAt" <= $2 AND $2 < o."endsAt") AS live
         FROM ads a
         JOIN show_occurrences o ON o.id = a."showOccurrenceId"
         JOIN programmes p ON p.id = o."programmeId"
         JOIN show_occurrence_hosts h ON h."occurrenceId" = o.id
         JOIN rjs r ON r.id = h."rjId" AND r."ownerListenerId" = $1
         JOIN ad_creatives c ON c.id = a."creativeId"
         JOIN advertisers adv ON adv.id = a."advertiserId"
        WHERE a.kind = 'shoutout' AND ${RUNNABLE_AD('a')} AND o."endsAt" > $2 AND o."startsAt" < $3
        ORDER BY o."startsAt", adv."businessName"`,
      [listenerId, now, new Date(now.getTime() + 24 * HOUR)],
    );
  }

  // ----------------------------------------------------------- public side

  /** The ad page: the creative, who it is from, and where it was heard. */
  async page(adId: string, showId: string | undefined) {
    const [ad] = await this.dataSource.query(
      `SELECT a.id, a.kind, a."stationId", c.id AS "creativeId", c.title, c."offerText", c.address, c.timings, c.phone, c.website, c."hasImage", c."updatedAt",
              adv."businessName", s.name AS "stationName", s.slug AS "stationSlug",
              coalesce(p.name, op.name) AS "programmeName"
         FROM ads a
         JOIN ad_creatives c ON c.id = a."creativeId"
         JOIN advertisers adv ON adv.id = a."advertiserId"
         JOIN stations s ON s.id = a."stationId"
         LEFT JOIN programmes p ON p.id = a."programmeId"
         LEFT JOIN show_occurrences o ON o.id = a."showOccurrenceId"
         LEFT JOIN programmes op ON op.id = o."programmeId"
        WHERE a.id = $1 AND ${RUNNABLE_AD('a')}`,
      [adId],
    );
    if (!ad) throw new NotFoundException('This ad is no longer running.');
    let heardOn: string | null = ad.programmeName;
    if (showId && UUID.test(showId)) {
      const [show] = await this.dataSource.query(
        `SELECT p.name FROM show_occurrences o JOIN programmes p ON p.id = o."programmeId" WHERE o.id = $1 AND o."stationId" = $2`,
        [showId, ad.stationId],
      );
      if (show) heardOn = show.name;
    }
    return {
      id: ad.id,
      kind: ad.kind,
      title: ad.title,
      offerText: ad.offerText,
      address: ad.address,
      timings: ad.timings,
      phone: ad.phone,
      website: ad.website,
      imageUrl: ad.hasImage ? `/ad-creatives/${ad.creativeId}/image?v=${new Date(ad.updatedAt).getTime()}` : null,
      businessName: ad.businessName,
      station: { name: ad.stationName, slug: ad.stationSlug },
      heardOn,
    };
  }

  /**
   * A listener pressed Call or Visit website. Counted once per signed-in
   * listener per ad per month, whichever button; signed-out taps are not
   * counted.
   */
  async respond(listener: string | null, adId: string, input: { kind?: unknown; showId?: unknown }, now = new Date()) {
    const kind = input?.kind === 'call' || input?.kind === 'website' ? input.kind : null;
    if (!kind) throw new BadRequestException('Unknown response.');
    if (!listener) return { counted: false, reason: 'signed_out' };
    return this.dataSource.transaction(async (m) => {
      const [ad] = await m.query(`SELECT a.* FROM ads a WHERE a.id = $1 AND ${RUNNABLE_AD('a')}`, [adId]);
      if (!ad) throw new NotFoundException('This ad is no longer running.');
      let showOccurrenceId: string | null = ad.showOccurrenceId;
      let programmeId: string | null = ad.programmeId;
      if (!showOccurrenceId && typeof input.showId === 'string' && UUID.test(input.showId)) {
        const [show] = await m.query(`SELECT id, "programmeId" FROM show_occurrences WHERE id = $1 AND "stationId" = $2`, [input.showId, ad.stationId]);
        if (show) {
          showOccurrenceId = show.id;
          programmeId = show.programmeId;
        }
      }
      if (!programmeId && showOccurrenceId) {
        const [show] = await m.query(`SELECT "programmeId" FROM show_occurrences WHERE id = $1`, [showOccurrenceId]);
        programmeId = show?.programmeId ?? null;
      }
      const inserted = await m.query(
        `INSERT INTO ad_responses ("adId", "listenerId", month, kind, "viaShoutout", "stationId", "advertiserId", "programmeId", "showOccurrenceId")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT ("adId", "listenerId", month) DO NOTHING RETURNING id`,
        [adId, listener, indiaMonth(now), kind, ad.kind === 'shoutout', ad.stationId, ad.advertiserId, programmeId, showOccurrenceId],
      );
      return { counted: inserted.length > 0 };
    });
  }
}

@Controller()
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Get('stations/:stationId/ads/campaigns')
  list(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string) {
    return this.ads.list(listenerId(req), stationId);
  }

  @Get('stations/:stationId/ads/targets')
  targets(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string) {
    return this.ads.targets(listenerId(req), stationId);
  }

  @Post('stations/:stationId/ads/campaigns')
  create(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Body() body: NewAd) {
    return this.ads.create(listenerId(req), stationId, body ?? {});
  }

  @Post('stations/:stationId/ads/campaigns/:adId/approve')
  approve(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Param('adId', ParseUUIDPipe) adId: string) {
    return this.ads.decide(listenerId(req), stationId, adId, true, null);
  }

  @Post('stations/:stationId/ads/campaigns/:adId/reject')
  reject(
    @Req() req: Request,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Param('adId', ParseUUIDPipe) adId: string,
    @Body() body: { reason?: unknown },
  ) {
    return this.ads.decide(listenerId(req), stationId, adId, false, body?.reason);
  }

  @Post('stations/:stationId/ads/campaigns/:adId/withdraw')
  withdraw(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Param('adId', ParseUUIDPipe) adId: string) {
    return this.ads.withdraw(listenerId(req), stationId, adId);
  }

  @Post('ads/:adId/on-air')
  onAir(@Req() req: Request, @Param('adId', ParseUUIDPipe) adId: string) {
    return this.ads.putOnAir(listenerId(req), adId);
  }

  @Get('ads/shoutouts/rj')
  rjShoutouts(@Req() req: Request) {
    return this.ads.rjShoutouts(listenerId(req));
  }

  @Get('ads/:adId')
  page(@Param('adId', ParseUUIDPipe) adId: string, @Query('show') show?: string) {
    return this.ads.page(adId, show);
  }

  @Post('ads/:adId/respond')
  respond(@Req() req: Request, @Param('adId', ParseUUIDPipe) adId: string, @Body() body: { kind?: unknown; showId?: unknown }) {
    return this.ads.respond(req.isAuthenticated() ? (req.user as { id: string }).id : null, adId, body ?? {});
  }
}
