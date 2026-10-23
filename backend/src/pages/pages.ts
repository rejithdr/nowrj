import { Controller, Get, Injectable, Module, NotFoundException, Param } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { slotLabel, sortSlots } from '../programmes/schedule-rules';

const PUBLIC_RJ = `r."isActive" = true AND r."verificationStatus" IN ('verified', 'legacy')`;

type Host = { id: string; name: string; slug: string; photoUrl: string | null };
type ProgrammeSummary = {
  id: string;
  name: string;
  slug: string;
  scheduleText: string | null;
  station: { name: string; slug: string } | null;
  invitedStationName: string | null;
  hosts: Host[];
};

/**
 * Data for the public RJ, programme and station pages, straight from the
 * database. Only verified RJs and active programmes and stations are shown.
 */
@Injectable()
export class PagesService {
  constructor(private readonly dataSource: DataSource) {}

  private async programmes(whereSql: string, params: unknown[]): Promise<ProgrammeSummary[]> {
    const rows: (Omit<ProgrammeSummary, 'scheduleText' | 'station'> & { stationName: string | null; stationSlug: string | null })[] =
      await this.dataSource.query(
        `
        SELECT p.id, p.name, p.slug,
               s.name AS "stationName", s.slug AS "stationSlug",
               CASE WHEN p."stationId" IS NULL THEN i."stationName" END AS "invitedStationName",
               COALESCE((
                 SELECT json_agg(json_build_object('id', r.id, 'name', r.name, 'slug', r.slug, 'photoUrl', r."photoUrl") ORDER BY r.name)
                   FROM programme_rjs pr JOIN rjs r ON r.id = pr."rjId"
                  WHERE pr."programmeId" = p.id AND ${PUBLIC_RJ}
               ), '[]') AS hosts
          FROM programmes p
          LEFT JOIN stations s ON s.id = p."stationId" AND s."isActive" = true
          LEFT JOIN station_invites i ON i.id = p."stationInviteId"
         WHERE p."isActive" = true AND ${whereSql}
         ORDER BY p.name
        `,
        params,
      );
    if (!rows.length) return [];

    const slots: { programmeId: string; daysOfWeek: number[]; startTime: string; endTime: string }[] =
      await this.dataSource.query(
        `SELECT "programmeId", "daysOfWeek", "startTime"::text, "endTime"::text
           FROM programme_schedules
          WHERE "programmeId" = ANY($1) AND "validTo" IS NULL`,
        [rows.map((r) => r.id)],
      );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      scheduleText:
        sortSlots(slots.filter((s) => s.programmeId === row.id)).map(slotLabel).join(' · ') || null,
      station: row.stationName ? { name: row.stationName, slug: row.stationSlug! } : null,
      invitedStationName: row.invitedStationName,
      hosts: row.hosts,
    }));
  }

  /** Every active programme, for the homepage list. */
  allProgrammes() {
    return this.programmes('true', []);
  }

  async rj(slug: string) {
    const [rj] = await this.dataSource.query(
      `SELECT r.id, r.name, r.slug, r."photoUrl", s.name AS "stationName", s.slug AS "stationSlug"
         FROM rjs r LEFT JOIN stations s ON s.id = r."stationId" AND s."isActive" = true
        WHERE r.slug = $1 AND ${PUBLIC_RJ}`,
      [slug],
    );
    if (!rj) throw new NotFoundException('RJ not found.');
    return {
      id: rj.id,
      name: rj.name,
      slug: rj.slug,
      photoUrl: rj.photoUrl,
      station: rj.stationName ? { name: rj.stationName, slug: rj.stationSlug } : null,
      programmes: await this.programmes(
        `EXISTS (SELECT 1 FROM programme_rjs pr WHERE pr."programmeId" = p.id AND pr."rjId" = $1)`,
        [rj.id],
      ),
    };
  }

  async programme(slug: string) {
    const [programme] = await this.programmes(`p.slug = $1`, [slug]);
    if (!programme) throw new NotFoundException('Programme not found.');
    const [extra] = await this.dataSource.query(
      `SELECT p."callInPhone", s.city, s.state
         FROM programmes p LEFT JOIN stations s ON s.id = p."stationId"
        WHERE p.id = $1`,
      [programme.id],
    );
    return {
      ...programme,
      callInPhone: extra?.callInPhone ?? null,
      location: [extra?.city, extra?.state].filter(Boolean).join(', ') || null,
    };
  }

  async station(slug: string) {
    const [station] = await this.dataSource.query(
      `SELECT id, name, slug, city, state FROM stations WHERE slug = $1 AND "isActive" = true`,
      [slug],
    );
    if (!station) throw new NotFoundException('Station not found.');
    return {
      id: station.id,
      name: station.name,
      slug: station.slug,
      location: [station.city, station.state].filter(Boolean).join(', ') || null,
      programmes: await this.programmes(`p."stationId" = $1`, [station.id]),
    };
  }
}

/** Public page data: /pages/rj/:slug, /pages/programme/:slug, /pages/station/:slug. */
@Controller('pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get('programmes')
  allProgrammes() {
    return this.pages.allProgrammes();
  }

  @Get('rj/:slug')
  rj(@Param('slug') slug: string) {
    return this.pages.rj(slug);
  }

  @Get('programme/:slug')
  programme(@Param('slug') slug: string) {
    return this.pages.programme(slug);
  }

  @Get('station/:slug')
  station(@Param('slug') slug: string) {
    return this.pages.station(slug);
  }
}

@Module({ controllers: [PagesController], providers: [PagesService] })
export class PagesModule {}
