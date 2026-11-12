import { ShowsModule } from '../shows/shows.module';
import { AdsController, AdsService } from './ads';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  GoneException,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Delete,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { clean, EMAIL, PHONE, writeAudit } from '../onboarding/helpers';
import { imageType, MAX_BYTES as IMAGE_MAX } from '../rjs/rj-photos';
import { stationAccess } from '../orgs/access';
import { meets } from '../orgs/access-rules';
import type { Level } from '../orgs/entities';
import { emailHint, INVITE_DAYS } from '../orgs/invite-rules';
import { CONSENT_POINTS, CONSENT_VERSION } from './consent';

const DAY = 24 * 3600 * 1000;
const SCAN_MAX = 5 * 1024 * 1024;
const AD_AREAS = ['adsSponsored', 'adsShoutout', 'adsAired'] as const;

type Upload = { buffer: Buffer; size: number };
export type AdvertiserInput = { businessName?: string; contactName?: string; contactPhone?: string; email?: string };
export type CreativeInput = { title?: string; offerText?: string; address?: string; timings?: string; phone?: string; website?: string };

function listenerId(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}

/** Recognises a PDF by its first bytes. */
function scanType(data: Buffer): string | null {
  if (data.length > 4 && data.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  const image = imageType(data);
  return image === 'image/jpeg' || image === 'image/png' ? image : null;
}

function text(value: unknown, max: number, label: string, required = false): string | null {
  const v = clean(value);
  if (!v) {
    if (required) throw new BadRequestException(`Enter the ${label}.`);
    return null;
  }
  if (v.length > max) throw new BadRequestException(`The ${label} is too long (${max} characters at most).`);
  return v;
}

function website(value: unknown): string | null {
  const v = text(value, 255, 'website');
  if (!v) return null;
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(url);
    if (!u.hostname.includes('.')) throw new Error();
    return u.toString();
  } catch {
    throw new BadRequestException('Enter a valid website, such as example.com.');
  }
}

@Injectable()
export class AdvertisersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  // ----------------------------------------------------------------- checks

  /**
   * Staff at a station with ads switched on, whose designation gives at
   * least `need` on any of the three ad areas.
   */
  private async staff(m: EntityManager, listenerId: string, stationId: string, need: Level) {
    const [station] = await m.query(`SELECT id, name, "adsEnabled" FROM stations WHERE id = $1`, [stationId]);
    if (!station) throw new NotFoundException('Station not found.');
    if (!station.adsEnabled) throw new ForbiddenException('Ads are not switched on for this station yet. The NowRJ team turns them on.');
    const access = await stationAccess(m, listenerId, stationId);
    if (!access || !AD_AREAS.some((a) => meets(access.levels[a], need))) {
      throw new ForbiddenException(need === 'view' ? 'Your designation does not include ads.' : 'Your designation does not let you change ads.');
    }
    return station as { id: string; name: string };
  }

  private async linked(m: EntityManager, advertiserId: string, stationId: string) {
    const [row] = await m.query(
      `SELECT a.* FROM advertisers a JOIN advertiser_stations s ON s."advertiserId" = a.id
        WHERE a.id = $1 AND s."stationId" = $2 AND s.status <> 'ended'`,
      [advertiserId, stationId],
    );
    if (!row) throw new NotFoundException('This advertiser does not work with your station.');
    return row;
  }

  private async creativeAt(m: EntityManager, creativeId: string, stationId: string) {
    const [row] = await m.query(`SELECT * FROM ad_creatives WHERE id = $1 AND "stationId" = $2`, [creativeId, stationId]);
    if (!row) throw new NotFoundException('Creative not found at your station.');
    return row;
  }

  /** The advertiser's consent now: valid, waiting for the NowRJ team's check, or none. */
  private async consent(m: EntityManager, advertiserId: string) {
    const rows: { id: string; kind: string; status: string; createdAt: Date; checkedAt: Date | null; signedName: string | null; note: string | null }[] =
      await m.query(
        `SELECT id, kind, status, "createdAt", "checkedAt", "signedName", note FROM advertiser_consents
          WHERE "advertiserId" = $1 ORDER BY "createdAt" DESC`,
        [advertiserId],
      );
    const valid = rows.find((r) => r.status === 'valid');
    if (valid) return { status: 'valid' as const, kind: valid.kind, since: valid.checkedAt ?? valid.createdAt, signedName: valid.signedName };
    const pending = rows.find((r) => r.status === 'pending_check');
    if (pending) return { status: 'pending_check' as const, kind: 'scan', since: pending.createdAt, signedName: null };
    const last = rows[0];
    if (last?.status === 'withdrawn') return { status: 'withdrawn' as const, kind: last.kind, since: last.createdAt, signedName: null };
    if (last?.status === 'rejected') return { status: 'rejected' as const, kind: 'scan', since: last.createdAt, signedName: null, note: last.note };
    return { status: 'none' as const, kind: null, since: null, signedName: null };
  }

  private async newInvite(m: EntityManager, advertiserId: string, stationId: string, email: string, by: string, now: Date) {
    await m.query(
      `UPDATE advertiser_invites SET status = 'cancelled' WHERE "advertiserId" = $1 AND "stationId" = $2 AND status = 'sent'`,
      [advertiserId, stationId],
    );
    const token = randomBytes(24).toString('hex');
    await m.query(
      `INSERT INTO advertiser_invites ("advertiserId", "stationId", email, token, "invitedByListenerId", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [advertiserId, stationId, email, token, by, new Date(now.getTime() + INVITE_DAYS * DAY)],
    );
    return token;
  }

  // ------------------------------------------------------------ station side

  async list(listenerId: string, stationId: string, now = new Date()) {
    const m = this.dataSource.manager;
    const station = await this.staff(m, listenerId, stationId, 'view');
    const access = (await stationAccess(m, listenerId, stationId))!;
    const rows: Record<string, unknown>[] = await m.query(
      `SELECT a.id, a."businessName", a."contactName", a."contactPhone", a.email, s.status AS "linkStatus",
              (SELECT count(*)::int FROM advertiser_members am WHERE am."advertiserId" = a.id) AS accounts,
              (SELECT count(*)::int FROM ad_creatives c WHERE c."advertiserId" = a.id AND c."stationId" = $1 AND c.status = 'active') AS creatives,
              (SELECT count(*)::int FROM ad_creative_suggestions g JOIN ad_creatives c ON c.id = g."creativeId"
                WHERE c."advertiserId" = a.id AND c."stationId" = $1 AND g.status = 'open') AS "openSuggestions",
              (SELECT json_build_object('token', i.token, 'expiresAt', i."expiresAt") FROM advertiser_invites i
                WHERE i."advertiserId" = a.id AND i."stationId" = $1 AND i.status = 'sent' AND i."expiresAt" > $2
                ORDER BY i."createdAt" DESC LIMIT 1) AS invite
         FROM advertisers a JOIN advertiser_stations s ON s."advertiserId" = a.id
        WHERE s."stationId" = $1 AND s.status <> 'ended'
        ORDER BY a."businessName"`,
      [stationId, now],
    );
    const advertisers = [];
    for (const row of rows) advertisers.push({ ...row, consent: await this.consent(m, row.id as string) });
    return {
      station,
      canEdit: AD_AREAS.some((a) => meets(access.levels[a], 'edit')),
      consentVersion: CONSENT_VERSION,
      advertisers,
    };
  }

  /**
   * Invite a business. If the email already belongs to an advertiser (at
   * another station), that business is linked to this station too; its
   * own details are kept (decision 9).
   */
  async invite(listenerId: string, stationId: string, input: AdvertiserInput, now = new Date()) {
    const businessName = text(input?.businessName, 150, 'business name', true)!;
    const contactName = text(input?.contactName, 100, 'contact person', true)!;
    const contactPhone = text(input?.contactPhone, 20, 'phone');
    if (contactPhone && !PHONE.test(contactPhone)) throw new BadRequestException('Phone number is not valid.');
    const email = clean(input?.email)?.toLowerCase();
    if (!email || !EMAIL.test(email) || email.length > 255) throw new BadRequestException("Enter the advertiser's email (their Google account).");

    return this.dataSource.transaction(async (m) => {
      await this.staff(m, listenerId, stationId, 'edit');
      let [advertiser] = await m.query(`SELECT * FROM advertisers WHERE lower(email) = $1`, [email]);
      const existing = Boolean(advertiser);
      if (advertiser) {
        const [link] = await m.query(
          `SELECT status FROM advertiser_stations WHERE "advertiserId" = $1 AND "stationId" = $2`,
          [advertiser.id, stationId],
        );
        if (link && link.status !== 'ended') throw new ConflictException(`${advertiser.businessName} already works with your station.`);
      } else {
        [advertiser] = await m.query(
          `INSERT INTO advertisers ("businessName", "contactName", "contactPhone", email, "createdByListenerId")
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [businessName, contactName, contactPhone, email, listenerId],
        );
      }
      await m.query(
        `INSERT INTO advertiser_stations ("advertiserId", "stationId", status, "invitedByListenerId")
         VALUES ($1, $2, 'invited', $3)
         ON CONFLICT ("advertiserId", "stationId") DO UPDATE SET status = 'invited', "invitedByListenerId" = $3, "joinedAt" = NULL`,
        [advertiser.id, stationId, listenerId],
      );
      const token = await this.newInvite(m, advertiser.id, stationId, email, listenerId, now);
      await writeAudit(m, listenerId, 'advertiser.invited', 'advertiser', advertiser.id, { stationId, email, existing });
      return { advertiserId: advertiser.id, businessName: advertiser.businessName, existing, token };
    });
  }

  async reinvite(listenerId: string, stationId: string, advertiserId: string, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      await this.staff(m, listenerId, stationId, 'edit');
      const advertiser = await this.linked(m, advertiserId, stationId);
      const token = await this.newInvite(m, advertiser.id, stationId, advertiser.email, listenerId, now);
      await writeAudit(m, listenerId, 'advertiser.reinvited', 'advertiser', advertiser.id, { stationId });
      return { token };
    });
  }

  /** A signed paper consent, scanned. The NowRJ team checks it before it counts. */
  async uploadScan(listenerId: string, stationId: string, advertiserId: string, file: Upload | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose the scanned consent form.');
    if (file.size > SCAN_MAX) throw new BadRequestException('That file is too large. Please keep it under 5 MB.');
    const type = scanType(file.buffer);
    if (!type) throw new BadRequestException('Upload the scan as a PDF, JPEG or PNG.');
    return this.dataSource.transaction(async (m) => {
      await this.staff(m, listenerId, stationId, 'edit');
      await this.linked(m, advertiserId, stationId);
      const current = await this.consent(m, advertiserId);
      if (current.status === 'valid') throw new ConflictException('This advertiser has already given consent.');
      await m.query(
        `UPDATE advertiser_consents SET status = 'rejected', note = 'Replaced by a newer scan' WHERE "advertiserId" = $1 AND status = 'pending_check'`,
        [advertiserId],
      );
      const [row] = await m.query(
        `INSERT INTO advertiser_consents ("advertiserId", kind, status, version, "uploadedByListenerId", "stationId", scan, "scanType")
         VALUES ($1, 'scan', 'pending_check', $2, $3, $4, $5, $6) RETURNING id`,
        [advertiserId, CONSENT_VERSION, listenerId, stationId, file.buffer, type],
      );
      await writeAudit(m, listenerId, 'advertiser.consent_scan_uploaded', 'advertiser', advertiserId, { stationId, consentId: row.id });
      return { status: 'pending_check' };
    });
  }

  async creatives(listenerId: string, stationId: string, advertiserId: string) {
    const m = this.dataSource.manager;
    await this.staff(m, listenerId, stationId, 'view');
    await this.linked(m, advertiserId, stationId);
    return this.creativeRows(m, `c."advertiserId" = $1 AND c."stationId" = $2`, [advertiserId, stationId]);
  }

  private async creativeRows(m: EntityManager, where: string, params: unknown[]) {
    return m.query(
      `SELECT c.id, c."advertiserId", c."stationId", s.name AS "stationName", c.title, c."offerText", c.address, c.timings,
              c.phone, c.website, c."hasImage", c.status, c."updatedAt",
              COALESCE((SELECT json_agg(json_build_object('id', g.id, 'text', g.text, 'status', g.status, 'createdAt', g."createdAt") ORDER BY g."createdAt" DESC)
                          FROM ad_creative_suggestions g WHERE g."creativeId" = c.id), '[]') AS suggestions
         FROM ad_creatives c JOIN stations s ON s.id = c."stationId"
        WHERE ${where} AND c.status = 'active'
        ORDER BY c."updatedAt" DESC`,
      params,
    );
  }

  private creativeFields(input: CreativeInput, partial: boolean) {
    const out: Record<string, string | null> = {};
    const set = (key: keyof CreativeInput, value: () => string | null) => {
      if (partial && input[key] === undefined) return;
      out[key] = value();
    };
    set('title', () => text(input.title, 100, 'title', true));
    set('offerText', () => text(input.offerText, 300, 'offer', true));
    set('address', () => text(input.address, 300, 'address'));
    set('timings', () => text(input.timings, 150, 'timings'));
    set('phone', () => {
      const v = text(input.phone, 20, 'phone');
      if (v && !PHONE.test(v)) throw new BadRequestException('Phone number is not valid.');
      return v;
    });
    set('website', () => website(input.website));
    return out;
  }

  async createCreative(listenerId: string, stationId: string, advertiserId: string, input: CreativeInput) {
    const fields = this.creativeFields(input ?? {}, false);
    return this.dataSource.transaction(async (m) => {
      await this.staff(m, listenerId, stationId, 'edit');
      await this.linked(m, advertiserId, stationId);
      const [row] = await m.query(
        `INSERT INTO ad_creatives ("advertiserId", "stationId", title, "offerText", address, timings, phone, website, "createdByListenerId", "updatedByListenerId")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING id`,
        [advertiserId, stationId, fields.title, fields.offerText, fields.address, fields.timings, fields.phone, fields.website, listenerId],
      );
      await writeAudit(m, listenerId, 'ad_creative.created', 'ad_creative', row.id, { stationId, advertiserId, title: fields.title });
      return { id: row.id };
    });
  }

  async updateCreative(listenerId: string, stationId: string, creativeId: string, input: CreativeInput) {
    const fields = this.creativeFields(input ?? {}, true);
    const keys = Object.keys(fields);
    if (!keys.length) throw new BadRequestException('Nothing to change.');
    return this.dataSource.transaction(async (m) => {
      await this.staff(m, listenerId, stationId, 'edit');
      const before = await this.creativeAt(m, creativeId, stationId);
      const sets = keys.map((k, i) => `"${k}" = $${i + 3}`).join(', ');
      await m.query(`UPDATE ad_creatives SET ${sets}, "updatedByListenerId" = $2, "updatedAt" = now() WHERE id = $1`, [
        creativeId,
        listenerId,
        ...keys.map((k) => fields[k]),
      ]);
      await writeAudit(m, listenerId, 'ad_creative.updated', 'ad_creative', creativeId, {
        stationId,
        from: Object.fromEntries(keys.map((k) => [k, before[k]])),
        to: fields,
      });
      return { id: creativeId };
    });
  }

  async archiveCreative(listenerId: string, stationId: string, creativeId: string) {
    return this.dataSource.transaction(async (m) => {
      await this.staff(m, listenerId, stationId, 'edit');
      await this.creativeAt(m, creativeId, stationId);
      await m.query(`UPDATE ad_creatives SET status = 'archived', "updatedByListenerId" = $2, "updatedAt" = now() WHERE id = $1`, [creativeId, listenerId]);
      await writeAudit(m, listenerId, 'ad_creative.archived', 'ad_creative', creativeId, { stationId });
      return { id: creativeId, status: 'archived' };
    });
  }

  async setImage(listenerId: string, stationId: string, creativeId: string, file: Upload | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose an image.');
    if (file.size > IMAGE_MAX) throw new BadRequestException('That image is too large. Please use one under 1 MB.');
    const type = imageType(file.buffer);
    if (!type) throw new BadRequestException('Please upload a JPEG, PNG or WebP image.');
    return this.dataSource.transaction(async (m) => {
      await this.staff(m, listenerId, stationId, 'edit');
      await this.creativeAt(m, creativeId, stationId);
      await m.query(
        `INSERT INTO ad_creative_images ("creativeId", data, "contentType", "updatedAt") VALUES ($1, $2, $3, now())
         ON CONFLICT ("creativeId") DO UPDATE SET data = EXCLUDED.data, "contentType" = EXCLUDED."contentType", "updatedAt" = now()`,
        [creativeId, file.buffer, type],
      );
      await m.query(`UPDATE ad_creatives SET "hasImage" = true, "updatedAt" = now(), "updatedByListenerId" = $2 WHERE id = $1`, [creativeId, listenerId]);
      return { hasImage: true };
    });
  }

  async removeImage(listenerId: string, stationId: string, creativeId: string) {
    return this.dataSource.transaction(async (m) => {
      await this.staff(m, listenerId, stationId, 'edit');
      await this.creativeAt(m, creativeId, stationId);
      await m.query(`DELETE FROM ad_creative_images WHERE "creativeId" = $1`, [creativeId]);
      await m.query(`UPDATE ad_creatives SET "hasImage" = false, "updatedAt" = now() WHERE id = $1`, [creativeId]);
      return { hasImage: false };
    });
  }

  async image(creativeId: string): Promise<{ data: Buffer; contentType: string } | null> {
    const [row] = await this.dataSource.query(`SELECT data, "contentType" FROM ad_creative_images WHERE "creativeId" = $1`, [creativeId]);
    return row ?? null;
  }

  async suggestionDone(listenerId: string, stationId: string, suggestionId: string) {
    return this.dataSource.transaction(async (m) => {
      await this.staff(m, listenerId, stationId, 'edit');
      const [row] = await m.query(
        `UPDATE ad_creative_suggestions g SET status = 'done', "doneByListenerId" = $3
           FROM ad_creatives c
          WHERE g.id = $1 AND c.id = g."creativeId" AND c."stationId" = $2 RETURNING g.id`,
        [suggestionId, stationId, listenerId],
      );
      if (!row) throw new NotFoundException('Suggestion not found.');
      return { id: row.id, status: 'done' };
    });
  }

  // --------------------------------------------------------- advertiser side

  async inviteInfo(token: string, listenerId: string | null, now = new Date()) {
    const m = this.dataSource.manager;
    const [invite] = await m.query(
      `SELECT i.*, a."businessName", s.name AS "stationName" FROM advertiser_invites i
         JOIN advertisers a ON a.id = i."advertiserId" JOIN stations s ON s.id = i."stationId"
        WHERE i.token = $1`,
      [token],
    );
    if (!invite) throw new NotFoundException('This invite link is not valid.');
    const consent = await this.consent(m, invite.advertiserId);
    return {
      businessName: invite.businessName,
      stationName: invite.stationName,
      emailHint: emailHint(invite.email),
      status: invite.status,
      expired: new Date(invite.expiresAt) < now,
      consentNeeded: consent.status !== 'valid',
      consentVersion: CONSENT_VERSION,
      consentPoints: CONSENT_POINTS,
      signedIn: Boolean(listenerId),
    };
  }

  async accept(listenerId: string, token: string, input: { agree?: unknown; signedName?: unknown }, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const [invite] = await m.query(`SELECT * FROM advertiser_invites WHERE token = $1 FOR UPDATE`, [token]);
      if (!invite) throw new NotFoundException('This invite link is not valid.');
      if (invite.status !== 'sent') throw new GoneException('This invite has already been used or cancelled.');
      if (new Date(invite.expiresAt) < now) throw new GoneException('This invite has expired. Ask the station for a new one.');
      const [listener] = await m.query(`SELECT id, email FROM listeners WHERE id = $1 AND "isActive"`, [listenerId]);
      if (!listener) throw new NotFoundException('Account not found.');
      if ((listener.email ?? '').trim().toLowerCase() !== invite.email.toLowerCase()) {
        throw new ForbiddenException(`This invite is for ${emailHint(invite.email)}. Sign in with that Google account.`);
      }

      const consent = await this.consent(m, invite.advertiserId);
      if (consent.status !== 'valid') {
        const signedName = text(input?.signedName, 100, 'your full name');
        if (input?.agree !== true || !signedName) {
          throw new BadRequestException('Read the consent, tick that you agree and type your full name.');
        }
        const [row] = await m.query(
          `INSERT INTO advertiser_consents ("advertiserId", kind, status, version, "signedName", "acceptedByListenerId", "stationId")
           VALUES ($1, 'digital', 'valid', $2, $3, $4, $5) RETURNING id`,
          [invite.advertiserId, CONSENT_VERSION, signedName, listenerId, invite.stationId],
        );
        await writeAudit(m, listenerId, 'advertiser.consent_given', 'advertiser', invite.advertiserId, { consentId: row.id, version: CONSENT_VERSION });
      }
      await m.query(
        `INSERT INTO advertiser_members ("advertiserId", "listenerId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [invite.advertiserId, listenerId],
      );
      await m.query(
        `UPDATE advertiser_stations SET status = 'active', "joinedAt" = $3 WHERE "advertiserId" = $1 AND "stationId" = $2`,
        [invite.advertiserId, invite.stationId, now],
      );
      await m.query(`UPDATE advertiser_invites SET status = 'accepted', "acceptedByListenerId" = $2, "acceptedAt" = $3 WHERE id = $1`, [
        invite.id,
        listenerId,
        now,
      ]);
      await writeAudit(m, listenerId, 'advertiser.joined', 'advertiser', invite.advertiserId, { stationId: invite.stationId });
      return { advertiserId: invite.advertiserId };
    });
  }

  private async member(m: EntityManager, listenerId: string, advertiserId: string) {
    const [row] = await m.query(`SELECT 1 FROM advertiser_members WHERE "advertiserId" = $1 AND "listenerId" = $2`, [advertiserId, listenerId]);
    if (!row) throw new ForbiddenException('This business is not linked to your account.');
  }

  /** The advertiser dashboard: each business, its stations, consent and creatives. */
  async me(listenerId: string) {
    const m = this.dataSource.manager;
    const businesses: Record<string, unknown>[] = await m.query(
      `SELECT a.id, a."businessName", a."contactName", a.email FROM advertisers a
         JOIN advertiser_members am ON am."advertiserId" = a.id
        WHERE am."listenerId" = $1 ORDER BY a."businessName"`,
      [listenerId],
    );
    const out = [];
    for (const b of businesses) {
      const id = b.id as string;
      out.push({
        ...b,
        consent: await this.consent(m, id),
        stations: await m.query(
          `SELECT s.id, s.name, s.slug, l.status FROM advertiser_stations l JOIN stations s ON s.id = l."stationId"
            WHERE l."advertiserId" = $1 AND l.status <> 'ended' ORDER BY s.name`,
          [id],
        ),
        creatives: await this.creativeRows(m, `c."advertiserId" = $1`, [id]),
      });
    }
    return { consentVersion: CONSENT_VERSION, consentPoints: CONSENT_POINTS, businesses: out };
  }

  async suggest(listenerId: string, creativeId: string, input: { text?: unknown }) {
    const body = text(input?.text, 500, 'suggestion', true)!;
    return this.dataSource.transaction(async (m) => {
      const [creative] = await m.query(`SELECT "advertiserId" FROM ad_creatives WHERE id = $1 AND status = 'active'`, [creativeId]);
      if (!creative) throw new NotFoundException('Creative not found.');
      await this.member(m, listenerId, creative.advertiserId);
      const [row] = await m.query(
        `INSERT INTO ad_creative_suggestions ("creativeId", "listenerId", text) VALUES ($1, $2, $3) RETURNING id`,
        [creativeId, listenerId, body],
      );
      return { id: row.id };
    });
  }

  async giveConsent(listenerId: string, advertiserId: string, input: { agree?: unknown; signedName?: unknown }) {
    return this.dataSource.transaction(async (m) => {
      await this.member(m, listenerId, advertiserId);
      if ((await this.consent(m, advertiserId)).status === 'valid') throw new ConflictException('Consent is already in place.');
      const signedName = text(input?.signedName, 100, 'your full name');
      if (input?.agree !== true || !signedName) throw new BadRequestException('Tick that you agree and type your full name.');
      await m.query(
        `INSERT INTO advertiser_consents ("advertiserId", kind, status, version, "signedName", "acceptedByListenerId")
         VALUES ($1, 'digital', 'valid', $2, $3, $4)`,
        [advertiserId, CONSENT_VERSION, signedName, listenerId],
      );
      await writeAudit(m, listenerId, 'advertiser.consent_given', 'advertiser', advertiserId, { version: CONSENT_VERSION });
      return { status: 'valid' };
    });
  }

  async withdrawConsent(listenerId: string, advertiserId: string, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      await this.member(m, listenerId, advertiserId);
      const rows = await m.query(
        `UPDATE advertiser_consents SET status = 'withdrawn', "withdrawnAt" = $2
          WHERE "advertiserId" = $1 AND status IN ('valid','pending_check') RETURNING id`,
        [advertiserId, now],
      );
      if (!rows.length) throw new ConflictException('There is no consent to withdraw.');
      await writeAudit(m, listenerId, 'advertiser.consent_withdrawn', 'advertiser', advertiserId, {});
      return { status: 'withdrawn' };
    });
  }

  // ------------------------------------------------------------ Super Admin

  async adminStations() {
    return this.dataSource.query(`
      SELECT s.id, s.name, s.city, s."adsEnabled", s."adsAgreementAt" IS NOT NULL AS "hasAgreement",
             o.id AS "organisationId", o.name AS "organisationName", o.kind AS "organisationKind", o."stationType",
             (SELECT count(*)::int FROM advertiser_stations l WHERE l."stationId" = s.id AND l.status <> 'ended') AS advertisers
        FROM stations s LEFT JOIN organisations o ON o.id = s."organisationId"
       WHERE s."verificationStatus" IN ('verified','legacy')
       ORDER BY o.name NULLS LAST, s.name`);
  }

  /**
   * Government stations (Akashvani) get ads only once an agreement with
   * Prasar Bharati is signed: switching them on needs `agreement: true`.
   */
  async adminSetAds(adminId: string, stationId: string, enabled: unknown, agreement?: unknown) {
    if (typeof enabled !== 'boolean') throw new BadRequestException('Say whether ads are on or off.');
    return this.dataSource.transaction(async (m) => {
      const [station] = await m.query(
        `SELECT s.id, s."adsAgreementAt", o."stationType" FROM stations s LEFT JOIN organisations o ON o.id = s."organisationId" WHERE s.id = $1`,
        [stationId],
      );
      if (!station) throw new NotFoundException('Station not found.');
      if (enabled && station.stationType === 'government' && !station.adsAgreementAt) {
        if (agreement !== true) {
          throw new BadRequestException('This is a government station. Confirm the signed agreement with Prasar Bharati to switch ads on.');
        }
        await m.query(`UPDATE stations SET "adsAgreementAt" = now() WHERE id = $1`, [stationId]);
      }
      const [row] = await m.query(`UPDATE stations SET "adsEnabled" = $2 WHERE id = $1 RETURNING id, name`, [stationId, enabled]);
      await writeAudit(m, adminId, enabled ? 'station.ads_on' : 'station.ads_off', 'station', stationId, { name: row.name });
      return { id: stationId, adsEnabled: enabled };
    });
  }

  async adminSetType(adminId: string, organisationId: string, type: unknown) {
    if (type !== 'commercial' && type !== 'non_commercial' && type !== 'government') {
      throw new BadRequestException('Choose commercial, non-commercial or government.');
    }
    return this.dataSource.transaction(async (m) => {
      const [org] = await m.query(`UPDATE organisations SET "stationType" = $2 WHERE id = $1 RETURNING id, name`, [organisationId, type]);
      if (!org) throw new NotFoundException('Organisation not found.');
      // A government station without a signed agreement cannot keep ads on.
      if (type === 'government') {
        await m.query(`UPDATE stations SET "adsEnabled" = false WHERE "organisationId" = $1 AND "adsAgreementAt" IS NULL`, [organisationId]);
      }
      await writeAudit(m, adminId, 'organisation.type_set', 'organisation', organisationId, { name: org.name, stationType: type });
      return { id: organisationId, stationType: type };
    });
  }

  async adminScans() {
    return this.dataSource.query(`
      SELECT c.id, c."createdAt", c."scanType", a."businessName", a."contactName", a.email, s.name AS "stationName",
             l."displayName" AS "uploadedBy"
        FROM advertiser_consents c
        JOIN advertisers a ON a.id = c."advertiserId"
        LEFT JOIN stations s ON s.id = c."stationId"
        LEFT JOIN listeners l ON l.id = c."uploadedByListenerId"
       WHERE c.status = 'pending_check'
       ORDER BY c."createdAt"`);
  }

  async adminScanFile(consentId: string) {
    const [row] = await this.dataSource.query(`SELECT scan, "scanType" FROM advertiser_consents WHERE id = $1 AND kind = 'scan'`, [consentId]);
    if (!row) throw new NotFoundException('Scan not found.');
    return row as { scan: Buffer; scanType: string };
  }

  async adminDecideScan(adminId: string, consentId: string, approve: boolean, noteInput: unknown, now = new Date()) {
    const note = text(noteInput, 300, 'reason');
    if (!approve && !note) throw new BadRequestException('Give a reason so the station knows what to fix.');
    return this.dataSource.transaction(async (m) => {
      const [row] = await m.query(
        `UPDATE advertiser_consents SET status = $2, "checkedByListenerId" = $3, "checkedAt" = $4, note = $5
          WHERE id = $1 AND status = 'pending_check' RETURNING "advertiserId"`,
        [consentId, approve ? 'valid' : 'rejected', adminId, now, note],
      );
      if (!row) throw new NotFoundException('Scan waiting for a check not found.');
      await writeAudit(m, adminId, approve ? 'advertiser.consent_scan_approved' : 'advertiser.consent_scan_rejected', 'advertiser', row.advertiserId, {
        consentId,
        note,
      });
      return { id: consentId, status: approve ? 'valid' : 'rejected' };
    });
  }
}

/** Station staff: /stations/:stationId/ads/... */
@Controller('stations/:stationId/ads')
export class StationAdsController {
  constructor(private readonly ads: AdvertisersService) {}

  @Get('advertisers')
  list(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string) {
    return this.ads.list(listenerId(req), stationId);
  }

  @Post('advertisers')
  invite(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Body() body: AdvertiserInput) {
    return this.ads.invite(listenerId(req), stationId, body ?? {});
  }

  @Post('advertisers/:advertiserId/invite')
  reinvite(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Param('advertiserId', ParseUUIDPipe) advertiserId: string) {
    return this.ads.reinvite(listenerId(req), stationId, advertiserId);
  }

  @Post('advertisers/:advertiserId/consent-scan')
  @UseInterceptors(FileInterceptor('scan', { limits: { fileSize: SCAN_MAX, files: 1 } }))
  scan(
    @Req() req: Request,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Param('advertiserId', ParseUUIDPipe) advertiserId: string,
    @UploadedFile() file: Upload | undefined,
  ) {
    return this.ads.uploadScan(listenerId(req), stationId, advertiserId, file);
  }

  @Get('advertisers/:advertiserId/creatives')
  creatives(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Param('advertiserId', ParseUUIDPipe) advertiserId: string) {
    return this.ads.creatives(listenerId(req), stationId, advertiserId);
  }

  @Post('advertisers/:advertiserId/creatives')
  createCreative(
    @Req() req: Request,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Param('advertiserId', ParseUUIDPipe) advertiserId: string,
    @Body() body: CreativeInput,
  ) {
    return this.ads.createCreative(listenerId(req), stationId, advertiserId, body ?? {});
  }

  @Patch('creatives/:creativeId')
  updateCreative(
    @Req() req: Request,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Param('creativeId', ParseUUIDPipe) creativeId: string,
    @Body() body: CreativeInput,
  ) {
    return this.ads.updateCreative(listenerId(req), stationId, creativeId, body ?? {});
  }

  @Post('creatives/:creativeId/archive')
  archive(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Param('creativeId', ParseUUIDPipe) creativeId: string) {
    return this.ads.archiveCreative(listenerId(req), stationId, creativeId);
  }

  @Post('creatives/:creativeId/image')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: IMAGE_MAX, files: 1 } }))
  image(
    @Req() req: Request,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Param('creativeId', ParseUUIDPipe) creativeId: string,
    @UploadedFile() file: Upload | undefined,
  ) {
    return this.ads.setImage(listenerId(req), stationId, creativeId, file);
  }

  @Delete('creatives/:creativeId/image')
  removeImage(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Param('creativeId', ParseUUIDPipe) creativeId: string) {
    return this.ads.removeImage(listenerId(req), stationId, creativeId);
  }

  @Post('suggestions/:suggestionId/done')
  done(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Param('suggestionId', ParseUUIDPipe) suggestionId: string) {
    return this.ads.suggestionDone(listenerId(req), stationId, suggestionId);
  }
}

/** Public creative image: /ad-creatives/:id/image (shown on ads). */
@Controller('ad-creatives')
export class CreativeImageController {
  constructor(private readonly ads: AdvertisersService) {}

  @Get(':id/image')
  async show(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const image = await this.ads.image(id);
    if (!image) throw new NotFoundException('No image.');
    res.set({ 'Content-Type': image.contentType, 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    res.send(image.data);
  }
}

/** The business's side: invite link, dashboard, suggestions and consent. */
@Controller()
export class AdvertiserController {
  constructor(private readonly ads: AdvertisersService) {}

  /** The consent wording, for the printable form. */
  @Get('advertiser-consent')
  consentText() {
    return { version: CONSENT_VERSION, points: CONSENT_POINTS };
  }

  @Get('advertiser-invites/:token')
  info(@Req() req: Request, @Param('token') token: string) {
    return this.ads.inviteInfo(token, req.isAuthenticated() ? (req.user as { id: string }).id : null);
  }

  @Post('advertiser-invites/:token/accept')
  accept(@Req() req: Request, @Param('token') token: string, @Body() body: { agree?: unknown; signedName?: unknown }) {
    return this.ads.accept(listenerId(req), token, body ?? {});
  }

  @Get('advertiser/me')
  me(@Req() req: Request) {
    return this.ads.me(listenerId(req));
  }

  @Post('advertiser/creatives/:creativeId/suggestions')
  suggest(@Req() req: Request, @Param('creativeId', ParseUUIDPipe) creativeId: string, @Body() body: { text?: unknown }) {
    return this.ads.suggest(listenerId(req), creativeId, body ?? {});
  }

  @Post('advertiser/:advertiserId/consent')
  give(@Req() req: Request, @Param('advertiserId', ParseUUIDPipe) advertiserId: string, @Body() body: { agree?: unknown; signedName?: unknown }) {
    return this.ads.giveConsent(listenerId(req), advertiserId, body ?? {});
  }

  @Post('advertiser/:advertiserId/consent/withdraw')
  withdraw(@Req() req: Request, @Param('advertiserId', ParseUUIDPipe) advertiserId: string) {
    return this.ads.withdrawConsent(listenerId(req), advertiserId);
  }
}

/** Super Admin: the ads switch per station, and checking scanned consents. */
@Controller('admin/ads')
@UseGuards(SuperadminGuard)
export class AdminAdsController {
  constructor(private readonly ads: AdvertisersService) {}

  @Get('stations')
  stations() {
    return this.ads.adminStations();
  }

  @Post('stations/:stationId')
  setAds(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Body() body: { enabled?: unknown; agreement?: unknown }) {
    return this.ads.adminSetAds(listenerId(req), stationId, body?.enabled, body?.agreement);
  }

  /** Commercial, non-commercial (community) or government. */
  @Post('organisations/:organisationId/type')
  setType(@Req() req: Request, @Param('organisationId', ParseUUIDPipe) organisationId: string, @Body() body: { stationType?: unknown }) {
    return this.ads.adminSetType(listenerId(req), organisationId, body?.stationType);
  }

  @Get('consents')
  scans() {
    return this.ads.adminScans();
  }

  @Get('consents/:id/scan')
  async scanFile(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const file = await this.ads.adminScanFile(id);
    res.set({ 'Content-Type': file.scanType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.send(file.scan);
  }

  @Post('consents/:id/approve')
  approve(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.ads.adminDecideScan(listenerId(req), id, true, null);
  }

  @Post('consents/:id/reject')
  reject(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { note?: unknown }) {
    return this.ads.adminDecideScan(listenerId(req), id, false, body?.note);
  }
}

@Module({
  imports: [ShowsModule],
  controllers: [StationAdsController, CreativeImageController, AdvertiserController, AdminAdsController, AdsController],
  providers: [AdvertisersService, AdsService],
})
export class AdsModule {}
