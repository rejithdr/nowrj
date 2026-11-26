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
import { DataSource, EntityManager } from 'typeorm';
import { decryptText, encryptText } from '../crypto/field-crypto';
import { HOUR, limit } from '../rate-limit';
import { CONTACT_RULE_MESSAGE, hasContactDetails } from '../shows/text-rules';
import { RUNNABLE_AD } from './placement';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE = /^\+?[0-9][0-9 -]{5,18}$/;
/** Phone numbers on leads are cleared after this many days. */
export const LEAD_PHONE_DAYS = 90;
/** Leads one listener may send in a day. */
const MAX_PER_DAY = 20;
/** Messages in one conversation. */
const MAX_REPLIES = 30;

/** Price per lead in rupees. A placeholder until billing is decided (LEAD_PRICE_INR in the backend settings). */
export function leadPriceInr(): number {
  const n = Number(process.env.LEAD_PRICE_INR ?? 8);
  return Number.isFinite(n) && n >= 0 && n <= 10000 ? Math.round(n * 100) / 100 : 8;
}

export const consentText = (business: string) =>
  `I agree that NowRJ shares my name and this phone number with ${business} so they can contact me about this offer.`.slice(0, 300);

function words(value: unknown, max: number, label: string, required: boolean): string | null {
  const t = typeof value === 'string' ? value.trim() : '';
  if (!t) {
    if (required) throw new BadRequestException(`Write your ${label}.`);
    return null;
  }
  if (t.length > max) throw new BadRequestException(`Keep your ${label} under ${max} characters.`);
  if (hasContactDetails(t)) throw new BadRequestException(CONTACT_RULE_MESSAGE);
  return t;
}

type Reply = { id: string; fromBusiness: boolean; body: string; createdAt: Date };

/**
 * "I'm interested": a listener asks a business to get in touch, either by
 * sharing a phone number (with consent) or by message inside NowRJ. The
 * business sees its leads on the advertiser dashboard; stations see counts.
 */
@Injectable()
export class AdLeadsService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.clearOldPhones().catch(() => undefined), HOUR);
    this.timer.unref();
    setTimeout(() => void this.clearOldPhones().catch(() => undefined), 90_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async clearOldPhones(now = new Date()) {
    await this.dataSource.query(
      `UPDATE ad_leads SET phone = NULL, "phoneClearedAt" = $1
        WHERE phone IS NOT NULL AND "createdAt" < $1::timestamptz - make_interval(days => $2)`,
      [now, LEAD_PHONE_DAYS],
    );
  }

  private replies(m: EntityManager, leadIds: string[]): Promise<(Reply & { leadId: string })[]> {
    if (!leadIds.length) return Promise.resolve([]);
    return m.query(
      `SELECT id, "leadId", "fromBusiness", body, "createdAt" FROM ad_lead_replies WHERE "leadId" = ANY($1) ORDER BY "createdAt"`,
      [leadIds],
    );
  }

  // ---------------------------------------------------------------- listener

  /** The listener's own enquiry on this ad (if any), with the conversation. */
  async mine(listenerId: string, adId: string) {
    const m = this.dataSource.manager;
    const [lead] = await m.query(
      `SELECT l.id, l.kind, l.message, l.phone IS NOT NULL AS "phoneShared", l.status, l."withdrawnAt", l."createdAt", adv."businessName"
         FROM ad_leads l JOIN advertisers adv ON adv.id = l."advertiserId"
        WHERE l."adId" = $1 AND l."listenerId" = $2`,
      [adId, listenerId],
    );
    if (!lead) return { lead: null };
    await m.query(`UPDATE ad_lead_replies SET "readAt" = now() WHERE "leadId" = $1 AND "fromBusiness" AND "readAt" IS NULL`, [lead.id]);
    return { lead: { ...lead, replies: await this.replies(m, [lead.id]) } };
  }

  async create(listenerId: string, adId: string, input: { kind?: unknown; phone?: unknown; agree?: unknown; message?: unknown; showId?: unknown }) {
    const kind = input?.kind === 'phone' || input?.kind === 'message' ? input.kind : null;
    if (!kind) throw new BadRequestException('Choose to share your number or send a message.');
    let phone: string | null = null;
    if (kind === 'phone') {
      phone = typeof input.phone === 'string' ? input.phone.trim() : '';
      if (!PHONE.test(phone)) throw new BadRequestException('Enter your phone number (6 to 19 digits, optionally starting with +).');
      if (input.agree !== true) throw new BadRequestException('Tick that you agree to share your number with the business.');
    }
    const message = words(input.message, 300, 'message', kind === 'message');

    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtext('ad-lead:' || $1))`, [listenerId]);
      const [ad] = await m.query(
        `SELECT a.id, a."advertiserId", a."stationId", a."programmeId", a."showOccurrenceId", adv."businessName"
           FROM ads a JOIN advertisers adv ON adv.id = a."advertiserId"
          WHERE a.id = $1 AND ${RUNNABLE_AD('a')}`,
        [adId],
      );
      if (!ad) throw new NotFoundException('This ad is no longer running.');
      const [me] = await m.query(`SELECT "displayName" FROM listeners WHERE id = $1 AND "isActive"`, [listenerId]);
      if (!me) throw new UnauthorizedException('Please sign in first.');
      const [existing] = await m.query(`SELECT id FROM ad_leads WHERE "adId" = $1 AND "listenerId" = $2`, [adId, listenerId]);
      if (existing) throw new ConflictException('You have already told this business you are interested. Your conversation is below.');
      const [{ today }] = await m.query(
        `SELECT count(*)::int AS today FROM ad_leads WHERE "listenerId" = $1 AND "createdAt" > now() - interval '1 day'`,
        [listenerId],
      );
      if (today >= MAX_PER_DAY) throw new ForbiddenException('You have contacted a lot of businesses today. Please try again tomorrow.');

      let { showOccurrenceId, programmeId } = ad as { showOccurrenceId: string | null; programmeId: string | null };
      if (!showOccurrenceId && typeof input.showId === 'string' && UUID.test(input.showId)) {
        const [show] = await m.query(`SELECT id, "programmeId" FROM show_occurrences WHERE id = $1 AND "stationId" = $2`, [input.showId, ad.stationId]);
        if (show) ({ id: showOccurrenceId, programmeId } = show);
      }
      if (!programmeId && showOccurrenceId) {
        const [show] = await m.query(`SELECT "programmeId" FROM show_occurrences WHERE id = $1`, [showOccurrenceId]);
        programmeId = show?.programmeId ?? null;
      }
      const [row] = await m.query(
        `INSERT INTO ad_leads ("adId", "advertiserId", "stationId", "programmeId", "showOccurrenceId", "listenerId", kind, name, phone, message, "consentText", "priceInr")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, kind, message, status, "createdAt"`,
        [
          adId, ad.advertiserId, ad.stationId, programmeId, showOccurrenceId, listenerId, kind,
          String(me.displayName ?? 'A listener').slice(0, 100),
          encryptText(phone), message, kind === 'phone' ? consentText(ad.businessName) : null, leadPriceInr(),
        ],
      );
      return { lead: { ...row, phoneShared: kind === 'phone', withdrawnAt: null, businessName: ad.businessName, replies: [] } };
    });
  }

  /** A follow-up from the listener in their conversation with the business. */
  async listenerReply(listenerId: string, leadId: string, input: { body?: unknown }) {
    const body = words(input?.body, 500, 'message', true)!;
    return this.dataSource.transaction(async (m) => {
      const [lead] = await m.query(`SELECT id, "withdrawnAt" FROM ad_leads WHERE id = $1 AND "listenerId" = $2 FOR UPDATE`, [leadId, listenerId]);
      if (!lead) throw new NotFoundException('Enquiry not found.');
      if (lead.withdrawnAt) throw new ForbiddenException('You withdrew this enquiry.');
      await this.roomFor(m, leadId);
      const [row] = await m.query(
        `INSERT INTO ad_lead_replies ("leadId", "fromBusiness", "listenerId", body) VALUES ($1, false, $2, $3) RETURNING id, "fromBusiness", body, "createdAt"`,
        [leadId, listenerId, body],
      );
      return row;
    });
  }

  /** The listener stops the conversation: their number is removed now and the business can no longer reply. */
  async withdraw(listenerId: string, leadId: string) {
    const [row] = await this.dataSource.query(
      `UPDATE ad_leads SET phone = NULL, "phoneClearedAt" = COALESCE("phoneClearedAt", now()), "withdrawnAt" = now(), status = 'closed'
        WHERE id = $1 AND "listenerId" = $2 AND "withdrawnAt" IS NULL RETURNING id`,
      [leadId, listenerId],
    );
    if (!row) throw new NotFoundException('Enquiry not found.');
    return { id: leadId, withdrawn: true };
  }

  private async roomFor(m: EntityManager, leadId: string) {
    const [{ n }] = await m.query(`SELECT count(*)::int AS n FROM ad_lead_replies WHERE "leadId" = $1`, [leadId]);
    if (n >= MAX_REPLIES) throw new ForbiddenException('This conversation is long enough. Please call the business instead.');
  }

  // ---------------------------------------------------------------- business

  private async member(m: EntityManager, listenerId: string, advertiserId: string) {
    const [row] = await m.query(`SELECT 1 FROM advertiser_members WHERE "advertiserId" = $1 AND "listenerId" = $2`, [advertiserId, listenerId]);
    if (!row) throw new ForbiddenException('This business is not linked to your account.');
  }

  /** The business's leads (last 6 months), with phone numbers while kept, and this month's count at the per-lead rate. */
  async forBusiness(listenerId: string, advertiserId: string) {
    const m = this.dataSource.manager;
    await this.member(m, listenerId, advertiserId);
    const rows: {
      id: string; kind: string; name: string; phone: string | null; message: string | null; status: string; priceInr: string;
      withdrawnAt: Date | null; phoneClearedAt: Date | null; createdAt: Date; adTitle: string; stationName: string; programmeName: string | null;
    }[] = await m.query(
      `SELECT l.id, l.kind, l.name, l.phone, l.message, l.status, l."priceInr", l."withdrawnAt", l."phoneClearedAt", l."createdAt",
              c.title AS "adTitle", s.name AS "stationName", p.name AS "programmeName"
         FROM ad_leads l
         JOIN ads a ON a.id = l."adId" JOIN ad_creatives c ON c.id = a."creativeId"
         JOIN stations s ON s.id = l."stationId"
         LEFT JOIN programmes p ON p.id = l."programmeId"
        WHERE l."advertiserId" = $1 AND l."createdAt" > now() - interval '6 months'
        ORDER BY (l.status = 'new') DESC, l."createdAt" DESC
        LIMIT 300`,
      [advertiserId],
    );
    const replies = await this.replies(m, rows.map((r) => r.id));
    const [month] = await m.query(
      `SELECT count(*)::int AS leads, COALESCE(sum("priceInr"), 0)::float AS amount
         FROM ad_leads WHERE "advertiserId" = $1 AND "createdAt" >= date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`,
      [advertiserId],
    );
    await m.query(
      `UPDATE ad_lead_replies r SET "readAt" = now() FROM ad_leads l
        WHERE l.id = r."leadId" AND l."advertiserId" = $1 AND NOT r."fromBusiness" AND r."readAt" IS NULL`,
      [advertiserId],
    );
    return {
      pricePerLead: leadPriceInr(),
      thisMonth: { leads: month.leads, amountInr: month.amount },
      leads: rows.map((r) => ({
        ...r,
        priceInr: Number(r.priceInr),
        phone: r.withdrawnAt ? null : decryptText(r.phone),
        replies: replies.filter((x) => x.leadId === r.id).map(({ leadId: _leadId, ...x }) => x),
      })),
    };
  }

  private async leadForBusiness(m: EntityManager, listenerId: string, leadId: string) {
    const [lead] = await m.query(`SELECT id, "advertiserId", "withdrawnAt" FROM ad_leads WHERE id = $1 FOR UPDATE`, [leadId]);
    if (!lead) throw new NotFoundException('Lead not found.');
    await this.member(m, listenerId, lead.advertiserId);
    return lead as { id: string; advertiserId: string; withdrawnAt: Date | null };
  }

  async setStatus(listenerId: string, leadId: string, status: unknown) {
    if (status !== 'new' && status !== 'contacted' && status !== 'closed') throw new BadRequestException('Choose a status.');
    return this.dataSource.transaction(async (m) => {
      await this.leadForBusiness(m, listenerId, leadId);
      await m.query(`UPDATE ad_leads SET status = $2, "handledAt" = now() WHERE id = $1`, [leadId, status]);
      return { id: leadId, status };
    });
  }

  async businessReply(listenerId: string, leadId: string, input: { body?: unknown }) {
    const body = words(input?.body, 500, 'reply', true)!;
    return this.dataSource.transaction(async (m) => {
      const lead = await this.leadForBusiness(m, listenerId, leadId);
      if (lead.withdrawnAt) throw new ForbiddenException('The listener withdrew this enquiry.');
      await this.roomFor(m, leadId);
      const [row] = await m.query(
        `INSERT INTO ad_lead_replies ("leadId", "fromBusiness", "listenerId", body) VALUES ($1, true, $2, $3) RETURNING id, "fromBusiness", body, "createdAt"`,
        [leadId, listenerId, body],
      );
      await m.query(`UPDATE ad_leads SET status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END, "handledAt" = now() WHERE id = $1`, [leadId]);
      return row;
    });
  }
}

function signedIn(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}

/**
 * GET    ads/:adId/lead                 my enquiry on this ad
 * POST   ads/:adId/lead                 { kind: phone|message, phone, agree, message, showId }
 * POST   ad-leads/:id/messages          listener follow-up
 * DELETE ad-leads/:id                   listener withdraws (number removed)
 * GET    advertiser/leads?advertiserId= the business's leads
 * PATCH  advertiser/leads/:id           { status }
 * POST   advertiser/leads/:id/replies   { body }
 */
@Controller()
export class AdLeadsController {
  constructor(private readonly leads: AdLeadsService) {}

  @Get('ads/:adId/lead')
  mine(@Req() req: Request, @Param('adId', ParseUUIDPipe) adId: string) {
    return this.leads.mine(signedIn(req), adId);
  }

  @Post('ads/:adId/lead')
  create(@Req() req: Request, @Param('adId', ParseUUIDPipe) adId: string, @Body() body: Record<string, unknown>) {
    const listenerId = signedIn(req);
    limit(req, 'ad-lead', 30, HOUR);
    return this.leads.create(listenerId, adId, body ?? {});
  }

  @Post('ad-leads/:id/messages')
  listenerReply(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { body?: unknown }) {
    const listenerId = signedIn(req);
    limit(req, 'ad-lead-message', 60, HOUR);
    return this.leads.listenerReply(listenerId, id, body ?? {});
  }

  @Delete('ad-leads/:id')
  withdraw(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.withdraw(signedIn(req), id);
  }

  @Get('advertiser/leads')
  forBusiness(@Req() req: Request, @Query('advertiserId', ParseUUIDPipe) advertiserId: string) {
    return this.leads.forBusiness(signedIn(req), advertiserId);
  }

  @Patch('advertiser/leads/:id')
  setStatus(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { status?: unknown }) {
    return this.leads.setStatus(signedIn(req), id, body?.status);
  }

  @Post('advertiser/leads/:id/replies')
  businessReply(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { body?: unknown }) {
    return this.leads.businessReply(signedIn(req), id, body ?? {});
  }
}

@Module({ controllers: [AdLeadsController], providers: [AdLeadsService] })
export class AdLeadsModule {}
