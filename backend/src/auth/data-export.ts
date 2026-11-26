import { Controller, Get, Injectable, Module, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { decryptText } from '../crypto/field-crypto';
import { HOUR, limit } from '../rate-limit';

/** Rows kept per list, newest first, so one export stays a sensible size. */
const MAX_ROWS = 5000;

/**
 * "Download my data": everything NowRJ holds about the signed-in person, as
 * one JSON file (DPDP Act, right to information about personal data).
 *
 * Their own words and choices are included in full. Other people's personal
 * data is left out: a nominated person's phone number, staff names on
 * replies (only "the team" label), other listeners. Encrypted fields are
 * decrypted for the owner only.
 */
@Injectable()
export class DataExportService {
  constructor(private readonly dataSource: DataSource) {}

  async export(listenerId: string) {
    const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = [listenerId]) =>
      this.dataSource.query(sql, params) as Promise<T[]>;

    const [profile] = await q(
      `SELECT "displayName", email, "photoUrl", "createdAt", "updatedAt", "adultConfirmedAt",
              ("googleId" IS NOT NULL) AS "signsInWithGoogle"
         FROM listeners WHERE id = $1`,
    );

    const rj = await q<{ phone: string | null; email: string | null }>(
      `SELECT name, slug, email, phone, "photoUrl", "isActive", "verificationStatus", "referralCode", "suspendedAt", "createdAt"
         FROM rjs WHERE "ownerListenerId" = $1`,
    );

    const participations = await q<{ contactPhone: string | null }>(
      `SELECT x.kind, x.note, x."contactPhone", x."nomineeName", x.status, x."agreedAt", x."createdAt",
              x."phonesClearedAt", p.name AS programme, g."guestName" AS "guestRecording"
         FROM participations x JOIN programmes p ON p.id = x."programmeId"
         LEFT JOIN guest_sessions g ON g.id = x."guestSessionId"
        WHERE x."listenerId" = $1 ORDER BY x."createdAt" DESC LIMIT ${MAX_ROWS}`,
    );

    const leads = await q<{ phone: string | null }>(
      `SELECT l.kind, l.name, l.phone, l.message, l."consentText", l.status, l."withdrawnAt", l."phoneClearedAt", l."createdAt",
              adv."businessName" AS business, c.title AS ad, s.name AS station,
              COALESCE((SELECT json_agg(json_build_object('from', CASE WHEN r."fromBusiness" THEN adv."businessName" ELSE 'You' END,
                                                          'text', r.body, 'at', r."createdAt") ORDER BY r."createdAt")
                          FROM ad_lead_replies r WHERE r."leadId" = l.id), '[]') AS conversation
         FROM ad_leads l
         JOIN advertisers adv ON adv.id = l."advertiserId"
         JOIN ads a ON a.id = l."adId" JOIN ad_creatives c ON c.id = a."creativeId"
         JOIN stations s ON s.id = l."stationId"
        WHERE l."listenerId" = $1 ORDER BY l."createdAt" DESC LIMIT ${MAX_ROWS}`,
    );

    const data = {
      about: {
        service: 'NowRJ (nowrj.com), run by Now On FM',
        exportedAt: new Date().toISOString(),
        note:
          'Everything NowRJ holds about you. Other people\'s details (for example the phone number of someone you nominated) are left out. ' +
          'Questions: Grievance Officer, nowonfmindia@gmail.com.',
      },
      profile,
      rjProfile: rj.map((r) => ({ ...r, phone: decryptText(r.phone), email: decryptText(r.email) })),
      roles: await q(
        `SELECT r.role, r.status, s.name AS station, r."grantedAt", r."createdAt"
           FROM user_roles r LEFT JOIN stations s ON s.id = r."stationId" WHERE r."listenerId" = $1 ORDER BY r."createdAt"`,
      ),
      organisations: await q(
        `SELECT o.name AS organisation, u.name AS place, d.name AS designation, m.status, m."removedAt", m."createdAt"
           FROM org_members m JOIN organisations o ON o.id = m."organisationId"
           LEFT JOIN org_units u ON u.id = m."unitId" LEFT JOIN designations d ON d.id = m."designationId"
          WHERE m."listenerId" = $1 ORDER BY m."createdAt"`,
      ),
      businesses: await q(
        `SELECT a."businessName" AS business, m."createdAt" FROM advertiser_members m JOIN advertisers a ON a.id = m."advertiserId"
          WHERE m."listenerId" = $1`,
      ),
      follows: await q(
        `SELECT r.name AS rj, f."createdAt" FROM follows f JOIN rjs r ON r.id = f."rjId" WHERE f."listenerId" = $1 ORDER BY f."createdAt" DESC`,
      ),
      messagesToShows: await q(
        `SELECT s.kind, s."songTitle", s.artist, s.message, s."dedicatedTo", s."nameOnAir", s."okOnAir", s."askedOf", s.status,
                p.name AS programme, s."createdAt"
           FROM song_requests s LEFT JOIN programmes p ON p.id = s."programmeId"
          WHERE s."listenerId" = $1 ORDER BY s."createdAt" DESC LIMIT ${MAX_ROWS}`,
      ),
      privateMessages: await q(
        `SELECT p.name AS programme, c.body, c."createdAt",
                COALESCE((SELECT json_agg(json_build_object('from', r."asLabel", 'text', r.body, 'at', r."createdAt") ORDER BY r."createdAt")
                            FROM programme_comment_replies r WHERE r."commentId" = c.id), '[]') AS replies
           FROM programme_comments c JOIN programmes p ON p.id = c."programmeId"
          WHERE c."listenerId" = $1 ORDER BY c."createdAt" DESC LIMIT ${MAX_ROWS}`,
      ),
      takePartAndNominations: participations.map((r) => ({
        ...r,
        contactPhone: decryptText(r.contactPhone),
        nomineePhone: 'not included (it is the other person\'s data)',
      })),
      interestedInAds: leads.map((r) => ({ ...r, phone: decryptText(r.phone) })),
      adTaps: await q(
        `SELECT r.kind, adv."businessName" AS business, r.month, r."createdAt"
           FROM ad_responses r JOIN advertisers adv ON adv.id = r."advertiserId"
          WHERE r."listenerId" = $1 ORDER BY r."createdAt" DESC LIMIT ${MAX_ROWS}`,
      ),
      reactions: await q(
        `SELECT x.type, p.name AS programme, r.name AS rj, x."createdAt"
           FROM reactions x LEFT JOIN programmes p ON p.id = x."programmeId" LEFT JOIN rjs r ON r.id = x."rjId"
          WHERE x."listenerId" = $1 ORDER BY x."createdAt" DESC LIMIT ${MAX_ROWS}`,
      ),
      pollVotes: await q(
        `SELECT pl.question, o.label AS answer, v."createdAt"
           FROM poll_votes v JOIN polls pl ON pl.id = v."pollId" JOIN poll_options o ON o.id = v."optionId"
          WHERE v."listenerId" = $1 ORDER BY v."createdAt" DESC LIMIT ${MAX_ROWS}`,
      ),
      reportsYouMade: await q(
        `SELECT "targetType", reason, details, status, "createdAt" FROM reports WHERE "listenerId" = $1 ORDER BY "createdAt" DESC LIMIT ${MAX_ROWS}`,
      ),
      listeningActivity: await q(
        `SELECT e.type, p.name AS programme, e."createdAt"
           FROM engagement_events e LEFT JOIN programmes p ON p.id = e."programmeId"
          WHERE e."listenerId" = $1 ORDER BY e."createdAt" DESC LIMIT ${MAX_ROWS}`,
      ),
      referral: await q(
        `SELECT r.kind, rj.name AS "referredByRj", r."activatedAt", r."createdAt"
           FROM referrals r JOIN rjs rj ON rj.id = r."referrerRjId" WHERE r."referredListenerId" = $1`,
      ),
      noticesToYou: await q(`SELECT text, "readAt", "createdAt" FROM notices WHERE "listenerId" = $1 ORDER BY "createdAt" DESC LIMIT ${MAX_ROWS}`),
      yourActionsAsStaff: await q(
        `SELECT action, "entityType", "createdAt" FROM audit_log WHERE "actorListenerId" = $1 ORDER BY "createdAt" DESC LIMIT ${MAX_ROWS}`,
      ),
    };
    return data;
  }
}

/** GET auth/me/data: downloads the signed-in person's data as a JSON file. */
@Controller('auth/me')
export class DataExportController {
  constructor(private readonly service: DataExportService) {}

  @Get('data')
  async download(@Req() req: Request, @Res() res: Response) {
    if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
    limit(req, 'data-export', 10, HOUR);
    const data = await this.service.export((req.user as { id: string }).id);
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="nowrj-my-data-${day}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(JSON.stringify(data, null, 2));
  }
}

@Module({ controllers: [DataExportController], providers: [DataExportService] })
export class DataExportModule {}
