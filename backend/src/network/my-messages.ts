import { Controller, Get, Injectable, Module, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { DataSource } from 'typeorm';

/** Counts behind the dot on the account menu. */
export type Alerts = { replies: number; businessNew: number };

/**
 * A listener's conversations in one place: private messages to programmes
 * and "I'm interested" enquiries to businesses, newest activity first, with
 * how many replies they have not read.
 */
@Injectable()
export class MyMessagesService {
  constructor(private readonly dataSource: DataSource) {}

  async alerts(listenerId: string): Promise<Alerts> {
    const [row] = await this.dataSource.query(
      `SELECT
         (SELECT count(*)::int FROM programme_comment_replies r JOIN programme_comments c ON c.id = r."commentId"
           WHERE c."listenerId" = $1 AND r."readAt" IS NULL)
       + (SELECT count(*)::int FROM ad_lead_replies r JOIN ad_leads l ON l.id = r."leadId"
           WHERE l."listenerId" = $1 AND r."fromBusiness" AND r."readAt" IS NULL AND l."withdrawnAt" IS NULL) AS replies,
         (SELECT count(*)::int FROM ad_leads l JOIN advertiser_members am ON am."advertiserId" = l."advertiserId" AND am."listenerId" = $1
           WHERE l.status = 'new' AND l."withdrawnAt" IS NULL)
       + (SELECT count(*)::int FROM ad_lead_replies r JOIN ad_leads l ON l.id = r."leadId"
           JOIN advertiser_members am ON am."advertiserId" = l."advertiserId" AND am."listenerId" = $1
           WHERE NOT r."fromBusiness" AND r."readAt" IS NULL AND l."withdrawnAt" IS NULL) AS "businessNew"`,
      [listenerId],
    );
    return { replies: row.replies, businessNew: row.businessNew };
  }

  async threads(listenerId: string) {
    const rows: {
      kind: 'programme' | 'ad'; id: string; title: string; href: string; lastText: string; lastFrom: string; lastAt: Date; unread: number; closed: boolean;
    }[] = await this.dataSource.query(
      `SELECT * FROM (
         SELECT 'programme' AS kind, c.id, p.name AS title, '/programme/' || p.slug || '#messages' AS href,
                COALESCE(lr.body, c.body) AS "lastText", COALESCE(lr."asLabel", 'You') AS "lastFrom",
                COALESCE(lr."createdAt", c."createdAt") AS "lastAt",
                (SELECT count(*)::int FROM programme_comment_replies r WHERE r."commentId" = c.id AND r."readAt" IS NULL) AS unread,
                false AS closed
           FROM programme_comments c
           JOIN programmes p ON p.id = c."programmeId"
           LEFT JOIN LATERAL (SELECT body, "asLabel", "createdAt" FROM programme_comment_replies r WHERE r."commentId" = c.id ORDER BY r."createdAt" DESC LIMIT 1) lr ON true
          WHERE c."listenerId" = $1
         UNION ALL
         SELECT 'ad', l.id, adv."businessName" || ' · ' || cr.title, '/ad/' || l."adId",
                COALESCE(lr.body, l.message, 'You shared your number'),
                CASE WHEN lr.body IS NULL THEN 'You' WHEN lr."fromBusiness" THEN adv."businessName" ELSE 'You' END,
                COALESCE(lr."createdAt", l."createdAt"),
                (SELECT count(*)::int FROM ad_lead_replies r WHERE r."leadId" = l.id AND r."fromBusiness" AND r."readAt" IS NULL),
                l."withdrawnAt" IS NOT NULL
           FROM ad_leads l
           JOIN advertisers adv ON adv.id = l."advertiserId"
           JOIN ads a ON a.id = l."adId" JOIN ad_creatives cr ON cr.id = a."creativeId"
           LEFT JOIN LATERAL (SELECT body, "fromBusiness", "createdAt" FROM ad_lead_replies r WHERE r."leadId" = l.id ORDER BY r."createdAt" DESC LIMIT 1) lr ON true
          WHERE l."listenerId" = $1
       ) t
       ORDER BY "lastAt" DESC
       LIMIT 100`,
      [listenerId],
    );
    return rows;
  }
}

function signedIn(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}

/** GET me/messages: my conversations. GET me/alerts: unread counts. */
@Controller('me')
export class MyMessagesController {
  constructor(private readonly service: MyMessagesService) {}

  @Get('messages')
  threads(@Req() req: Request) {
    return this.service.threads(signedIn(req));
  }

  @Get('alerts')
  alerts(@Req() req: Request) {
    return this.service.alerts(signedIn(req));
  }
}

@Module({ controllers: [MyMessagesController], providers: [MyMessagesService], exports: [MyMessagesService] })
export class MyMessagesModule {}
