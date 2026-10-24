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
import { UserRole } from '../user-role.entity';
import { assertStationRep } from '../onboarding/helpers';
import { CONTACT_RULE_MESSAGE, hasContactDetails } from './text-rules';

/** The same limit applies to song requests and to questions. */
export const MAX_REQUESTS_PER_SHOW = 3;
export const MAX_TEXT = 200;
const HOUR = 3600 * 1000;
/** Requests and questions open this long before a show starts and close when it ends. */
export const REQUESTS_OPEN_BEFORE_MS = 24 * HOUR;

export type SongRequestInput = { songTitle?: string; artist?: string; message?: string; question?: string };

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
  kind: SongRequestKind | null;
  songTitle: string | null;
  artist: string | null;
  message: string | null;
  status: string | null;
  createdAt: string | null;
  listenerName: string | null;
};

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
      const kind: SongRequestKind = programme?.interactionType === 'question' ? 'question' : 'song';
      const what = kind === 'question' ? 'Questions' : 'Song requests';

      let songTitle: string | null = null;
      let artist: string | null = null;
      let message: string | null;
      if (kind === 'question') {
        message = clean(input.question ?? input.message, MAX_TEXT, 'Question');
        if (!message) throw new BadRequestException('Type your question.');
      } else {
        songTitle = clean(input.songTitle, 150, 'Song title');
        artist = clean(input.artist, 150, 'Artist');
        message = clean(input.message, MAX_TEXT, 'Message');
        if (!songTitle) throw new BadRequestException('Enter the song you want to hear.');
      }
      if ([songTitle, artist, message].some(hasContactDetails)) {
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
            : `You can request up to ${MAX_REQUESTS_PER_SHOW} songs per show.`,
        );
      }
      const duplicate = mine.find((r) =>
        kind === 'question'
          ? r.kind === 'question' && r.message?.toLowerCase() === message!.toLowerCase()
          : r.kind === 'song' && r.songTitle?.toLowerCase() === songTitle!.toLowerCase(),
      );
      if (duplicate) {
        throw new BadRequestException(
          kind === 'question' ? 'You have already asked that question for this show.' : 'You have already requested that song for this show.',
        );
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
          status: 'new',
        }),
      );
      return {
        id: saved.id,
        kind,
        songTitle,
        artist,
        message,
        status: saved.status,
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
      requests: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        songTitle: r.songTitle,
        artist: r.artist,
        message: r.message,
        status: r.status,
      })),
    };
  }

  // ------------------------------------------------------------ RJ / station

  private async ownRj(listenerId: string) {
    const rj = await this.dataSource.manager.findOne(Rj, { where: { ownerListener: { id: listenerId } } });
    if (!rj) throw new NotFoundException('Register your RJ profile first.');
    return rj;
  }

  /** Groups queue rows by show, soonest first. */
  private group(rows: QueueRow[], now: Date) {
    const shows = new Map<string, {
      showId: string; programmeName: string; interactionType: SongRequestKind; startsAt: Date; endsAt: Date; live: boolean;
      requests: { id: string; kind: SongRequestKind; songTitle: string | null; artist: string | null; message: string | null; status: string; listenerName: string; createdAt: Date }[];
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
          requests: [],
        });
      }
      if (row.id) {
        // Only the first name is shown to the RJ and station.
        const name = (row.listenerName ?? 'A listener').trim().split(/\s+/)[0];
        shows.get(row.showId)!.requests.push({
          id: row.id,
          kind: row.kind ?? 'song',
          songTitle: row.songTitle,
          artist: row.artist,
          message: row.message,
          status: row.status!,
          listenerName: name,
          createdAt: new Date(row.createdAt!),
        });
      }
    }
    return [...shows.values()];
  }

  private queue(filterSql: string, param: string, now: Date) {
    return this.dataSource.query(
      `
      SELECT o.id AS "showId", o."startsAt", o."endsAt", p.name AS "programmeName", p."interactionType",
             r.id, r.kind, r."songTitle", r.artist, r.message, r.status, r."createdAt",
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
    return this.group(rows, now);
  }

  /** The same queue for every show aired on a station, for its approved representatives. */
  async forStation(listenerId: string, stationId: string, now = new Date()) {
    await assertStationRep(this.dataSource.manager, listenerId, stationId);
    const rows = await this.queue(`o."stationId" = $1`, stationId, now);
    return this.group(rows, now);
  }

  /**
   * A host RJ, or a representative of the show's station, marks a request
   * played (a question: answered on air), skipped, or back to new.
   */
  async setStatus(listenerId: string, requestId: string, status: unknown, now = new Date()) {
    if (status !== 'played' && status !== 'skipped' && status !== 'new') {
      throw new BadRequestException('Status must be played, skipped or new.');
    }
    const m = this.dataSource.manager;
    const request = await m.findOneBy(SongRequest, { id: requestId });
    if (!request) throw new NotFoundException('Request not found.');
    const show = await m.findOneBy(ShowOccurrence, { id: request.showOccurrenceId });
    if (!show) throw new NotFoundException('Show not found.');

    const rj = await m.findOne(Rj, { where: { ownerListener: { id: listenerId } } });
    const isHost = rj ? await m.existsBy(ShowOccurrenceHost, { occurrenceId: show.id, rjId: rj.id }) : false;
    const isStation = show.stationId
      ? await m.existsBy(UserRole, { listenerId, role: 'station_rep', stationId: show.stationId, status: 'active' })
      : false;
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
