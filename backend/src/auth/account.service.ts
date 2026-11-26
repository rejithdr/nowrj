import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { appendFileSync } from 'node:fs';
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

/**
 * Deleted accounts are also listed in a file outside the database, so that
 * after restoring an older backup they can be deleted again
 * (deploy/after-restore.sh). Only ids and dates, no personal data.
 */
export const ERASURE_LOG = process.env.ERASURE_LOG ?? '/srv/nowrj/erasures.log';

function recordErasure(listenerId: string, reason: string) {
  try {
    appendFileSync(ERASURE_LOG, `${new Date().toISOString()} ${listenerId} ${reason}\n`, { mode: 0o600 });
  } catch {
    // The deletion itself already happened; a missing log only matters after a restore.
  }
}

@Injectable()
export class AccountService {
  constructor(private readonly dataSource: DataSource) {}

  /** `reason` is recorded in the audit log: the person's own request, or under 18. */
  async deleteAccount(listenerId: string, reason: 'own_request' | 'under_18' = 'own_request') {
    await this.dataSource.transaction(async (m) => {
      const rjs: { id: string; name: string }[] = await m.query(
        `SELECT id, name FROM rjs WHERE "ownerListenerId" = $1`,
        [listenerId],
      );

      for (const rj of rjs) {
        // The RJ's name is also kept as text on programmes; erase it on every
        // programme they hosted or owned, including ones a station removed
        // them from earlier (programme ownership history, past show hosts).
        await m.query(
          `UPDATE programmes SET "rjName" = 'Former RJ'
            WHERE "rjName" = $2
              AND (id IN (SELECT "programmeId" FROM programme_rjs WHERE "rjId" = $1)
                   OR "ownerRjId" = $1
                   OR id IN (SELECT o."programmeId" FROM show_occurrence_hosts h
                               JOIN show_occurrences o ON o.id = h."occurrenceId" WHERE h."rjId" = $1))`,
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
      // Questions, dedications and messages must keep some text (database
      // rule), so their words are replaced; who a dedication was for is erased too.
      await m.query(
        `UPDATE song_requests
            SET message = CASE kind
                            WHEN 'question' THEN 'Question removed (account deleted)'
                            WHEN 'dedication' THEN 'Dedication removed (account deleted)'
                            WHEN 'message' THEN 'Message removed (account deleted)'
                            ELSE NULL END,
                "dedicatedTo" = CASE WHEN kind = 'dedication' THEN 'someone' ELSE NULL END
          WHERE "listenerId" = $1`,
        [listenerId],
      );
      // Requests to take part, nominations (with the phone numbers in them)
      // and private comments go with the account; team replies go with them.
      await m.query(`DELETE FROM participations WHERE "listenerId" = $1`, [listenerId]);
      await m.query(`DELETE FROM programme_comments WHERE "listenerId" = $1`, [listenerId]);
      // "I'm interested" enquiries (with any phone number shared) go too.
      await m.query(`DELETE FROM ad_leads WHERE "listenerId" = $1`, [listenerId]);
      await m.query(`UPDATE user_roles SET status = 'revoked' WHERE "listenerId" = $1`, [listenerId]);
      await m.query(
        `UPDATE org_members SET status = 'removed', "removedAt" = now() WHERE "listenerId" = $1 AND status = 'active'`,
        [listenerId],
      );
      // Open invitations sent to this person's email end with the account, so
      // staff no longer see the address in their lists.
      for (const table of ['org_invites', 'rj_invites', 'advertiser_invites']) {
        await m.query(
          `UPDATE ${table} SET status = 'cancelled'
            WHERE status IN ('sent', 'awaiting_approval') AND lower(email) = (SELECT lower(email) FROM listeners WHERE id = $1)`,
          [listenerId],
        );
      }
      await m.query(
        `UPDATE listeners SET "displayName" = 'Deleted user', email = NULL, "googleId" = NULL,
                "facebookId" = NULL, "photoUrl" = NULL, "isActive" = false
          WHERE id = $1`,
        [listenerId],
      );
      await writeAudit(m, listenerId, 'account.deleted', 'listener', listenerId, {
        reason,
        rjProfilesAnonymised: rjs.length,
        rjIds: rjs.map((rj) => rj.id),
      });
      // Sign the person out everywhere.
      await m.query(`DELETE FROM user_sessions WHERE sess->'passport'->>'user' = $1`, [listenerId]);
    });
    recordErasure(listenerId, reason);
  }
}
