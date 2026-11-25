import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ShowOccurrence } from '../show-occurrence.entity';
import { ShowOccurrenceHost } from '../show-occurrence-host.entity';
import { SongRequest, SongRequestKind, SongRequestStatus } from '../song-request.entity';
import { Listener } from '../listener.entity';
import { Programme } from '../programme.entity';
import { Rj } from '../rj.entity';
import { assertStationAccess, hasStationAccess } from '../orgs/access';
import { CONTACT_RULE_MESSAGE, hasContactDetails } from './text-rules';
import { onAirName, readOnAirConsent } from './on-air';

/** The same limit applies to song requests and to questions. */
export const MAX_REQUESTS_PER_SHOW = 3;
export const MAX_TEXT = 200;
const HOUR = 3600 * 1000;
/** Requests and questions open this long before a show starts and close when it ends. */
export const REQUESTS_OPEN_BEFORE_MS = 24 * HOUR;

export const MAX_DEDICATION = 140;

export type SongRequestInput = {
  kind?: string;
  songTitle?: string;
  artist?: string;
  message?: string;
  question?: string;
  dedicatedTo?: string;
  nameOnAir?: string;
  okOnAir?: boolean;
};

/** Labels for error messages. */
const KIND_WORDS: Record<SongRequestKind, { plural: string; one: string }> = {
  song: { plural: 'Song requests', one: 'song' },
  question: { plural: 'Questions', one: 'question' },
  dedication: { plural: 'Dedications', one: 'dedication' },
  message: { plural: 'Messages', one: 'message' },
};

function clean(value: unknown, max: number, label: string): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (trimmed.length > max) throw new BadRequestException(`${label} is too long (${max} characters at most).`);
  return trimmed;
}

export function requestsOpen(show: { startsAt: Date; endsAt: Date; status: string }, now: Date) {
  return (
    show.status === 'scheduled' &&
    now.getTime() >= show.startsAt.getTime() - REQUESTS_OPEN_BEFORE_MS &&
    now.getTime() < show.endsAt.getTime()
  );
}

type QueueRow = {
  showId: string;
  startsAt: string;
  endsAt: string;
  programmeName: string;
  interactionType: SongRequestKind;
  id: string | null;
  dedicatedTo: string | null;
  nameOnAir: string | null;
  okOnAir: boolean | null;
  seenAt: string | null;
  seenBy: string | null;
  kind: SongRequestKind | null;
  songTitle: string | null;
  artist: string | null;
  message: string | null;
  status: string | null;
  createdAt: string | null;
  listenerName: string | null;
};

type ShowCounts = { messages: number; readOnAir: number; senders: number; likes: number; fires: number; callTaps: number; total: number };
const emptyCounts = (): ShowCounts => ({ messages: 0, readOnAir: 0, senders: 0, likes: 0, fires: 0, callTaps: 0, total: 0 });

@Injectable()
export class SongRequestsService {
  constructor(private readonly dataSource: DataSource) {}

  // --------------------------------------------------------------- listener

  /**
   * A song request, or a question when the programme is in "Ask a question"
   * mode. Both share the per-show limit and the open/close times.
   */
  async create(listenerId: string, occurrenceId: string, input: SongRequestInput, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const show = await m.findOneBy(ShowOccurrence, { id: occurrenceId });
      if (!show) throw new NotFoundException('Show not found.');
      const programme = await m.findOneBy(Programme, { id: show.programmeId });
      // Question-mode programmes take questions only; others take songs, dedications and messages.
      let kind: SongRequestKind;
      if (programme?.interactionType === 'question') {
        kind = 'question';
      } else {
        const asked = input.kind ?? 'song';
        if (asked !== 'song' && asked !== 'dedication' && asked !== 'message') {
          throw new BadRequestException('Choose a song request, a dedication or a message.');
        }
        kind = asked;
      }
      const what = KIND_WORDS[kind].plural;
      const consent = readOnAirConsent(input);

      let songTitle: string | null = null;
      let artist: string | null = null;
      let dedicatedTo: string | null = null;
      let message: string | null;
      if (kind === 'question') {
        message = clean(input.question ?? input.message, MAX_TEXT, 'Question');
        if (!message) throw new BadRequestException('Type your question.');
      } else if (kind === 'message') {
        message = clean(input.message, MAX_TEXT, 'Message');
        if (!message) throw new BadRequestException('Type your message.');
      } else if (kind === 'dedication') {
        dedicatedTo = clean(input.dedicatedTo, 60, 'Who it is for');
        message = clean(input.message, MAX_DEDICATION, 'Dedication');
        songTitle = clean(input.songTitle, 150, 'Song title');
        artist = clean(input.artist, 150, 'Artist');
        if (!dedicatedTo) throw new BadRequestException('Say who the dedication is for.');
        if (!message) throw new BadRequestException('Type your dedication.');
      } else {
        songTitle = clean(input.songTitle, 150, 'Song title');
        artist = clean(input.artist, 150, 'Artist');
        message = clean(input.message, MAX_TEXT, 'Message');
        if (!songTitle) throw new BadRequestException('Enter the song you want to hear.');
      }
      if ([songTitle, artist, message, dedicatedTo].some(hasContactDetails)) {
        throw new BadRequestException(CONTACT_RULE_MESSAGE);
      }

      if (!requestsOpen(show, now)) {
        throw new ForbiddenException(`${what} open 24 hours before a show and close when it ends.`);
      }
      const listener = await m.findOneBy(Listener, { id: listenerId, isActive: true });
      if (!listener) throw new NotFoundException('Listener not found.');

      // Lock this listener's rows for the show so two quick taps cannot pass the limit.
      const mine = await m
        .createQueryBuilder(SongRequest, 'r')
        .setLock('pessimistic_write')
        .where('r.listenerId = :listenerId AND r.showOccurrenceId = :occurrenceId', { listenerId, occurrenceId })
        .getMany();
      if (mine.length >= MAX_REQUESTS_PER_SHOW) {
        throw new ForbiddenException(
          kind === 'question'
            ? `You can ask up to ${MAX_REQUESTS_PER_SHOW} questions per show.`
            : `You can send up to ${MAX_REQUESTS_PER_SHOW} requests, dedications or messages per show.`,
        );
      }
      const same = (a: string | null, b: string | null) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
      const duplicate = mine.find((r) =>
        r.kind === kind &&
        (kind === 'song' ? same(r.songTitle, songTitle) : kind === 'dedication' ? same(r.dedicatedTo, dedicatedTo) && same(r.message, message) : same(r.message, message)),
      );
      if (duplicate) {
        throw new BadRequestException(`You have already sent that ${KIND_WORDS[kind].one} for this show.`);
      }

      const saved = await m.save(
        m.create(SongRequest, {
          showOccurrenceId: show.id,
          programmeId: show.programmeId,
          listenerId,
          kind,
          songTitle,
          artist,
          message,
          dedicatedTo,
          status: 'new',
          nameOnAir: consent.nameOnAir,
          okOnAir: consent.okOnAir,
        }),
      );
      return {
        ...this.forListener(saved),
        remaining: MAX_REQUESTS_PER_SHOW - mine.length - 1,
      };
    });
  }

  /** The listener's own requests or questions for one show, with their status. */
  async mine(listenerId: string, occurrenceId: string) {
    const rows = await this.dataSource.manager.find(SongRequest, {
      where: { listenerId, showOccurrenceId: occurrenceId },
      order: { createdAt: 'ASC' },
    });
    return {
      max: MAX_REQUESTS_PER_SHOW,
      requests: rows.map((r) => this.forListener(r)),
    };
  }

  /** What a listener sees of their own message, including whether the RJ has seen it. */
  private forListener(r: SongRequest) {
    return {
      id: r.id,
      kind: r.kind,
      songTitle: r.songTitle,
      artist: r.artist,
      message: r.message,
      dedicatedTo: r.dedicatedTo,
      status: r.status,
      seenBy: r.seenAt ? r.seenBy : null,
      nameOnAir: r.nameOnAir,
      okOnAir: r.okOnAir,
    };
  }

  // ------------------------------------------------------------ RJ / station

  private async ownRj(listenerId: string) {
    const rj = await this.dataSource.manager.findOne(Rj, { where: { ownerListener: { id: listenerId } } });
    if (!rj) throw new NotFoundException('Register your RJ profile first.');
    return rj;
  }

  /** Groups queue rows by show, soonest first. */
  private group(rows: QueueRow[], now: Date, counts: Map<string, ShowCounts>) {
    const shows = new Map<string, {
      showId: string; programmeName: string; interactionType: SongRequestKind; startsAt: Date; endsAt: Date; live: boolean;
      counts: ShowCounts;
      requests: {
        id: string; kind: SongRequestKind; songTitle: string | null; artist: string | null; message: string | null;
        dedicatedTo: string | null; status: string; listenerName: string; okOnAir: boolean | null; seen: boolean; createdAt: Date;
      }[];
    }>();
    for (const row of rows) {
      if (!shows.has(row.showId)) {
        const startsAt = new Date(row.startsAt);
        const endsAt = new Date(row.endsAt);
        shows.set(row.showId, {
          showId: row.showId,
          programmeName: row.programmeName,
          interactionType: row.interactionType,
          startsAt,
          endsAt,
          live: startsAt <= now && now < endsAt,
          counts: counts.get(row.showId) ?? emptyCounts(),
          requests: [],
        });
      }
      if (row.id) {
        // Only the name the listener agreed may be read on air.
        shows.get(row.showId)!.requests.push({
          id: row.id,
          kind: row.kind ?? 'song',
          songTitle: row.songTitle,
          artist: row.artist,
          message: row.message,
          dedicatedTo: row.dedicatedTo,
          status: row.status!,
          listenerName: onAirName(row.listenerName, row.nameOnAir),
          okOnAir: row.okOnAir,
          seen: Boolean(row.seenAt),
          createdAt: new Date(row.createdAt!),
        });
      }
    }
    return [...shows.values()];
  }

  /** Messages, read on air, reactions and call taps for each show in the queue. */
  private async counts(showIds: string[]) {
    const counts = new Map<string, ShowCounts>();
    if (!showIds.length) return counts;
    const rows: (ShowCounts & { showId: string })[] = await this.dataSource.query(
      `
      SELECT o.id AS "showId",
             (SELECT count(*)::int FROM song_requests r WHERE r."showOccurrenceId" = o.id) AS messages,
             (SELECT count(*)::int FROM song_requests r WHERE r."showOccurrenceId" = o.id AND r.status = 'played') AS "readOnAir",
             (SELECT count(DISTINCT r."listenerId")::int FROM song_requests r WHERE r."showOccurrenceId" = o.id) AS senders,
             (SELECT count(*)::int FROM reactions x WHERE x."showOccurrenceId" = o.id AND x.type = 'like') AS likes,
             (SELECT count(*)::int FROM reactions x WHERE x."showOccurrenceId" = o.id AND x.type = 'fire') AS fires,
             (SELECT count(*)::int FROM engagement_events e WHERE e."showOccurrenceId" = o.id AND e.type = 'call_tap') AS "callTaps"
      FROM show_occurrences o WHERE o.id = ANY($1)
      `,
      [showIds],
    );
    for (const { showId, ...c } of rows) counts.set(showId, { ...c, total: c.messages + c.likes + c.fires + c.callTaps });
    return counts;
  }

  /** Marks messages as seen the first time they appear in the host RJ's or station's queue. */
  private async markSeen(rows: QueueRow[], by: 'rj' | 'station') {
    const ids = rows.filter((r) => r.id && !r.seenAt).map((r) => r.id!);
    if (!ids.length) return;
    await this.dataSource.query(
      `UPDATE song_requests SET "seenAt" = now(), "seenBy" = $2 WHERE id = ANY($1) AND "seenAt" IS NULL`,
      [ids, by],
    );
  }

  private async build(rows: QueueRow[], now: Date, by: 'rj' | 'station') {
    await this.markSeen(rows, by);
    const counts = await this.counts([...new Set(rows.map((r) => r.showId))]);
    return this.group(rows, now, counts);
  }

  private queue(filterSql: string, param: string, now: Date) {
    return this.dataSource.query(
      `
      SELECT o.id AS "showId", o."startsAt", o."endsAt", p.name AS "programmeName", p."interactionType",
             r.id, r.kind, r."songTitle", r.artist, r.message, r.status, r."createdAt",
             r."dedicatedTo", r."nameOnAir", r."okOnAir", r."seenAt", r."seenBy",
             l."displayName" AS "listenerName"
      FROM show_occurrences o
      JOIN programmes p ON p.id = o."programmeId"
      LEFT JOIN song_requests r ON r."showOccurrenceId" = o.id
      LEFT JOIN listeners l ON l.id = r."listenerId"
      WHERE ${filterSql}
        AND o.status = 'scheduled'
        AND o."endsAt" > $2
        AND o."startsAt" < $3
      ORDER BY o."startsAt", r."createdAt"
      `,
      [param, new Date(now.getTime() - 2 * HOUR), new Date(now.getTime() + 24 * HOUR)],
    ) as Promise<QueueRow[]>;
  }

  /**
   * Requests or questions for the RJ's shows that are live, coming up in the
   * next 24 hours, or ended in the last 2 hours.
   */
  async forRj(listenerId: string, now = new Date()) {
    const rj = await this.ownRj(listenerId);
    const rows = await this.queue(
      `EXISTS (SELECT 1 FROM show_occurrence_hosts h WHERE h."occurrenceId" = o.id AND h."rjId" = $1)`,
      rj.id,
      now,
    );
    return this.build(rows, now, 'rj');
  }

  /** The same queue for every show aired on a station, for staff with Programmes view. */
  async forStation(listenerId: string, stationId: string, now = new Date()) {
    await assertStationAccess(this.dataSource.manager, listenerId, stationId, 'programmes', 'view');
    const rows = await this.queue(`o."stationId" = $1`, stationId, now);
    return this.build(rows, now, 'station');
  }

  /**
   * A host RJ, or station staff with Programmes edit, marks a request
   * played (a question: answered on air), skipped, or back to new.
   */
  async setStatus(listenerId: string, requestId: string, status: unknown, now = new Date()) {
    if (status !== 'played' && status !== 'skipped' && status !== 'new') {
      throw new BadRequestException('Status must be played, skipped or new.');
    }
    const m = this.dataSource.manager;
    const request = await m.findOneBy(SongRequest, { id: requestId });
    // Guest questions are handled through /guest-sessions.
    if (!request?.showOccurrenceId) throw new NotFoundException('Request not found.');
    const show = await m.findOneBy(ShowOccurrence, { id: request.showOccurrenceId });
    if (!show) throw new NotFoundException('Show not found.');

    const rj = await m.findOne(Rj, { where: { ownerListener: { id: listenerId } } });
    const isHost = rj ? await m.existsBy(ShowOccurrenceHost, { occurrenceId: show.id, rjId: rj.id }) : false;
    const isStation = await hasStationAccess(m, listenerId, show.stationId, 'programmes', 'edit');
    if (!isHost && !isStation) {
      throw new ForbiddenException('Only the RJs hosting this show, or its station, can handle its requests.');
    }

    if (status === 'played' && show.startsAt.getTime() > now.getTime()) {
      throw new BadRequestException(
        request.kind === 'question'
          ? 'You can mark a question as answered once the show has started. You can skip it any time.'
          : 'You can mark a song as played once the show has started. You can skip it any time.',
      );
    }

    request.status = status as SongRequestStatus;
    request.handledByListenerId = status === 'new' ? null : listenerId;
    request.handledAt = status === 'new' ? null : new Date();
    await m.save(request);
    return { id: request.id, status: request.status };
  }
}
