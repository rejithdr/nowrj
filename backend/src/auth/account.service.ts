import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { writeAudit } from '../onboarding/helpers';

/**
 * Deletes a person's account at their request.
 *
 * Personal data is erased: name, email, Google link, photo, follows, station
 * roles and messages written with song requests. The listener row stays as an
 * anonymous id, so Likes, Fires, call taps, requested songs, referrals and the
 * audit log still add up, but nothing in them identifies the person.
 *
 * If the person is an RJ, the RJ profile is anonymised to "Former RJ" and
 * hidden. Programmes owned by a station stay with the station; programmes
 * the RJ owned alone are hidden, and unanswered station invites are cancelled.
 */
@Injectable()
export class AccountService {
  constructor(private readonly dataSource: DataSource) {}

  async deleteAccount(listenerId: string) {
    await this.dataSource.transaction(async (m) => {
      const rjs: { id: string; name: string }[] = await m.query(
        `SELECT id, name FROM rjs WHERE "ownerListenerId" = $1`,
        [listenerId],
      );

      for (const rj of rjs) {
        await m.query(
          `UPDATE programmes SET "rjName" = 'Former RJ'
            WHERE "rjName" = $2 AND id IN (SELECT "programmeId" FROM programme_rjs WHERE "rjId" = $1)`,
          [rj.id, rj.name],
        );
        await m.query(
          `UPDATE programmes SET "isActive" = false WHERE "ownerRjId" = $1 AND "ownerStationId" IS NULL`,
          [rj.id],
        );
        await m.query(
          `UPDATE station_invites SET status = 'cancelled' WHERE "invitedByRjId" = $1 AND status = 'sent'`,
          [rj.id],
        );
        await m.query(`DELETE FROM rj_photos WHERE "rjId" = $1`, [rj.id]);
        await m.query(`DELETE FROM rj_vouches WHERE "rjId" = $1 OR "voucherRjId" = $1`, [rj.id]);
        await m.query(
          `UPDATE rjs SET name = 'Former RJ', slug = 'former-rj-' || left(id::text, 8),
                  email = NULL, phone = NULL, "photoUrl" = NULL, "isActive" = false,
                  "verificationStatus" = 'deleted', "ownerListenerId" = NULL
            WHERE id = $1`,
          [rj.id],
        );
      }

      // Follows end with the account. Likes, Fires, call taps and song requests
      // stay in the shows' totals; they now point at an anonymous account, and
      // any personal message written with a request is erased.
      await m.query(`DELETE FROM follows WHERE "listenerId" = $1`, [listenerId]);
      await m.query(`UPDATE song_requests SET message = NULL WHERE "listenerId" = $1`, [listenerId]);
      await m.query(`UPDATE user_roles SET status = 'revoked' WHERE "listenerId" = $1`, [listenerId]);
      await m.query(
        `UPDATE listeners SET "displayName" = 'Deleted user', email = NULL, "googleId" = NULL,
                "facebookId" = NULL, "photoUrl" = NULL, "isActive" = false
          WHERE id = $1`,
        [listenerId],
      );
      await writeAudit(m, listenerId, 'account.deleted', 'listener', listenerId, {
        rjProfilesAnonymised: rjs.length,
        rjIds: rjs.map((rj) => rj.id),
      });
      // Sign the person out everywhere.
      await m.query(`DELETE FROM user_sessions WHERE sess->'passport'->>'user' = $1`, [listenerId]);
    });
  }
}
