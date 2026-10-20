import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { Rj } from '../rj.entity';
import { Referral } from '../referral.entity';
import { RjVouch } from '../rj-vouch.entity';
import { RjStationAffiliation } from '../rj-station-affiliation.entity';
import { Station } from '../station.entity';
import { NEW_ACCOUNT_WINDOW_MS, normaliseCode } from './referral-rules';

const DAY = 24 * 3600 * 1000;
const PUBLIC_RJ = ['verified', 'legacy'];

@Injectable()
export class ReferralsService {
  constructor(private readonly dataSource: DataSource) {}

  private async ownRj(listenerId: string) {
    const rj = await this.dataSource.manager.findOne(Rj, { where: { ownerListener: { id: listenerId } } });
    if (!rj) throw new NotFoundException('Register your RJ profile first.');
    return rj;
  }

  /** What the referral landing page shows. */
  async lookup(codeInput: string) {
    const code = normaliseCode(codeInput);
    const rj = code ? await this.dataSource.manager.findOneBy(Rj, { referralCode: code }) : null;
    if (!rj || !rj.isActive || !PUBLIC_RJ.includes(rj.verificationStatus)) {
      throw new NotFoundException('This referral link is not valid.');
    }
    return { code: rj.referralCode, rjName: rj.name, rjSlug: rj.slug, photoUrl: rj.photoUrl };
  }

  /**
   * Records that a brand-new account arrived through an RJ's link. Only
   * accounts created in the last 30 minutes count, and only once.
   */
  async claim(listenerId: string, codeInput: unknown) {
    const code = normaliseCode(codeInput);
    if (!code) return { recorded: false, reason: 'invalid_code' };

    return this.dataSource.transaction(async (m) => {
      // Age is worked out inside the database: listeners.createdAt has no time
      // zone, so comparing it with this server's clock can be hours off.
      const [row] = await m.query(
        `SELECT (localtimestamp - "createdAt") <= ($2 || ' milliseconds')::interval AS fresh
           FROM listeners WHERE id = $1`,
        [listenerId, String(NEW_ACCOUNT_WINDOW_MS)],
      );
      if (!row) throw new NotFoundException('Listener not found.');
      if (!row.fresh) {
        return { recorded: false, reason: 'existing_account' };
      }
      if (await m.existsBy(Referral, { referredListenerId: listenerId })) {
        return { recorded: false, reason: 'already_referred' };
      }
      const referrer = await m.findOneBy(Rj, { referralCode: code });
      if (!referrer || !PUBLIC_RJ.includes(referrer.verificationStatus)) {
        return { recorded: false, reason: 'invalid_code' };
      }
      const own = await m.findOne(Rj, { where: { ownerListener: { id: listenerId } } });
      if (own?.id === referrer.id) return { recorded: false, reason: 'self' };

      await m
        .createQueryBuilder()
        .insert()
        .into(Referral)
        .values({ referrerRjId: referrer.id, referredListenerId: listenerId, kind: own ? 'rj' : 'listener', referredRjId: own?.id ?? null })
        .orIgnore()
        .execute();
      return { recorded: true, rjName: referrer.name };
    });
  }

  /** The RJ's own link and what it has brought in. */
  async mine(listenerId: string, now = new Date()) {
    const rj = await this.ownRj(listenerId);
    const [listeners] = await this.dataSource.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE "createdAt" > $2)::int AS "last7Days"
         FROM referrals WHERE "referrerRjId" = $1`,
      [rj.id, new Date(now.getTime() - 7 * DAY)],
    );
    const rjRows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT r.name, r.slug, r."verificationStatus", f."activatedAt", f."rewardEndsAt", f."createdAt"
         FROM referrals f JOIN rjs r ON r.id = f."referredRjId"
        WHERE f."referrerRjId" = $1 AND f.kind = 'rj'
        ORDER BY f."createdAt" DESC`,
      [rj.id],
    );
    return {
      code: rj.referralCode,
      joined: listeners,
      rjs: rjRows.map((r) => {
        const endsAt = r.rewardEndsAt ? new Date(r.rewardEndsAt as string) : null;
        return {
          name: r.name,
          slug: r.slug,
          verificationStatus: r.verificationStatus,
          rewardStartedAt: r.activatedAt,
          rewardEndsAt: endsAt,
          rewardStatus: !endsAt ? 'waiting_for_verification' : endsAt > now ? 'active' : 'ended',
        };
      }),
    };
  }

  // ---------------------------------------------------------------- vouches

  private async verifiedRj(listenerId: string) {
    const rj = await this.ownRj(listenerId);
    if (!rj.isActive || !PUBLIC_RJ.includes(rj.verificationStatus)) {
      throw new ForbiddenException('Only verified RJs can vouch for others.');
    }
    return rj;
  }

  private async currentStationName(rjId: string) {
    const current = await this.dataSource.manager.findOne(RjStationAffiliation, {
      where: { rjId, leftOn: IsNull() },
    });
    if (!current) return null;
    return (await this.dataSource.manager.findOneBy(Station, { id: current.stationId }))?.name ?? null;
  }

  /** What a verified RJ sees on the vouch page. */
  async vouchTarget(listenerId: string, rjId: string) {
    const voucher = await this.verifiedRj(listenerId);
    const target = await this.dataSource.manager.findOneBy(Rj, { id: rjId });
    if (!target) throw new NotFoundException('RJ not found.');
    const already = await this.dataSource.manager.existsBy(RjVouch, { rjId, voucherRjId: voucher.id });
    return {
      name: target.name,
      station: await this.currentStationName(target.id),
      verificationStatus: target.verificationStatus,
      isYou: target.id === voucher.id,
      alreadyVouched: already,
    };
  }

  async vouch(listenerId: string, rjId: string, noteInput: unknown) {
    const note = typeof noteInput === 'string' ? noteInput.trim().replace(/\s+/g, ' ') || null : null;
    if (note && note.length > 280) throw new BadRequestException('Note is too long (280 characters at most).');
    const voucher = await this.verifiedRj(listenerId);
    if (voucher.id === rjId) throw new BadRequestException('You cannot vouch for yourself.');
    const target = await this.dataSource.manager.findOneBy(Rj, { id: rjId });
    if (!target) throw new NotFoundException('RJ not found.');
    if (target.verificationStatus !== 'pending') {
      throw new ConflictException(`${target.name} is not waiting for verification.`);
    }
    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(RjVouch)
      .values({ rjId, voucherRjId: voucher.id, note })
      .orIgnore()
      .returning(['id'])
      .execute();
    if (!(result.raw as unknown[]).length) {
      throw new ConflictException(`You have already vouched for ${target.name}.`);
    }
    return { vouched: true, rjName: target.name };
  }

  /** Vouches the signed-in RJ has received. */
  async myVouches(listenerId: string) {
    const rj = await this.ownRj(listenerId);
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT v.id, v.note, v."createdAt", r.name AS "voucherName", r.slug AS "voucherSlug"
         FROM rj_vouches v JOIN rjs r ON r.id = v."voucherRjId"
        WHERE v."rjId" = $1 ORDER BY v."createdAt"`,
      [rj.id],
    );
    return { rjId: rj.id, verificationStatus: rj.verificationStatus, vouches: rows };
  }

  /** For the Super Admin RJ page: vouches and referrer for every RJ, keyed by RJ id. */
  async adminVerificationInfo() {
    const vouches: { rjId: string; voucherName: string; note: string | null }[] = await this.dataSource.query(
      `SELECT v."rjId", r.name AS "voucherName", v.note
         FROM rj_vouches v JOIN rjs r ON r.id = v."voucherRjId" ORDER BY v."createdAt"`,
    );
    const referrals: { rjId: string; referrerName: string }[] = await this.dataSource.query(
      `SELECT f."referredRjId" AS "rjId", r.name AS "referrerName"
         FROM referrals f JOIN rjs r ON r.id = f."referrerRjId"
        WHERE f.kind = 'rj'`,
    );
    const info: Record<string, { vouches: { voucherName: string; note: string | null }[]; referredBy: string | null }> = {};
    const entry = (id: string) => (info[id] ??= { vouches: [], referredBy: null });
    for (const v of vouches) entry(v.rjId).vouches.push({ voucherName: v.voucherName, note: v.note });
    for (const r of referrals) entry(r.rjId).referredBy = r.referrerName;
    return info;
  }
}
