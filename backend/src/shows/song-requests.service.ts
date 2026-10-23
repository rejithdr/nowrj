import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ShowOccurrence } from '../show-occurrence.entity';
import { ShowOccurrenceHost } from '../show-occurrence-host.entity';
import { SongRequest, SongRequestStatus } from '../song-request.entity';
import { Listener } from '../listener.entity';
import { Rj } from '../rj.entity';

export const MAX_REQUESTS_PER_SHOW = 3;
const HOUR = 3600 * 1000;
/** Requests open this long before a show starts and close when it ends. */
export const REQUESTS_OPEN_BEFORE_MS = 24 * HOUR;

export type SongRequestInput = { songTitle?: string; artist?: string; message?: string };

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

@Injectable()
export class SongRequestsService {
  constructor(private readonly dataSource: DataSource) {}

  // --------------------------------------------------------------- listener

  async create(listenerId: string, occurrenceId: string, input: SongRequestInput, now = new Date()) {
    const songTitle = clean(input.songTitle, 150, 'Song title');
    const artist = clean(input.artist, 150, 'Artist');
    const message = clean(input.message, 200, 'Message');
    if (!songTitle) throw new BadRequestException('Enter the song you want to hear.');

    return this.dataSource.transaction(async (m) => {
      const show = await m.findOneBy(ShowOccurrence, { id: occurrenceId });
      if (!show) throw new NotFoundException('Show not found.');
      if (!requestsOpen(show, now)) {
        throw new ForbiddenException('Song requests open 24 hours before a show and close when it ends.');
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
        throw new ForbiddenException(`You can request up to ${MAX_REQUESTS_PER_SHOW} songs per show.`);
      }
      const duplicate = mine.find((r) => r.songTitle.toLowerCase() === songTitle.toLowerCase());
      if (duplicate) throw new BadRequestException('You have already requested that song for this show.');

      const saved = await m.save(
        m.create(SongRequest, {
          showOccurrenceId: show.id,
          programmeId: show.programmeId,
          listenerId,
          songTitle,
          artist,
          message,
          status: 'new',
        }),
      );
      return { id: saved.id, songTitle, artist, message, status: saved.status, remaining: MAX_REQUESTS_PER_SHOW - mine.length - 1 };
    });
  }

  /** The listener's own requests for one show, with their status. */
  async mine(listenerId: string, occurrenceId: string) {
    const rows = await this.dataSource.manager.find(SongRequest, {
      where: { listenerId, showOccurrenceId: occurrenceId },
      order: { createdAt: 'ASC' },
    });
    return {
      max: MAX_REQUESTS_PER_SHOW,
      requests: rows.map((r) => ({ id: r.id, songTitle: r.songTitle, artist: r.artist, message: r.message, status: r.status })),
    };
  }

  // --------------------------------------------------------------------- RJ

  private async ownRj(listenerId: string) {
    const rj = await this.dataSource.manager.findOne(Rj, { where: { ownerListener: { id: listenerId } } });
    if (!rj) throw new NotFoundException('Register your RJ profile first.');
    return rj;
  }

  /**
   * Requests for the RJ's shows that are live, coming up in the next 24 hours,
   * or ended in the last 2 hours, grouped by show (soonest first).
   */
  async forRj(listenerId: string, now = new Date()) {
    const rj = await this.ownRj(listenerId);
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `
      SELECT o.id AS "showId", o."startsAt", o."endsAt", p.name AS "programmeName",
             r.id, r."songTitle", r.artist, r.message, r.status, r."createdAt",
             l."displayName" AS "listenerName"
      FROM show_occurrences o
      JOIN show_occurrence_hosts h ON h."occurrenceId" = o.id AND h."rjId" = $1
      JOIN programmes p ON p.id = o."programmeId"
      LEFT JOIN song_requests r ON r."showOccurrenceId" = o.id
      LEFT JOIN listeners l ON l.id = r."listenerId"
      WHERE o.status = 'scheduled'
        AND o."endsAt" > $2
        AND o."startsAt" < $3
      ORDER BY o."startsAt", r."createdAt"
      `,
      [rj.id, new Date(now.getTime() - 2 * HOUR), new Date(now.getTime() + 24 * HOUR)],
    );

    const shows = new Map<string, {
      showId: string; programmeName: string; startsAt: Date; endsAt: Date; live: boolean;
      requests: { id: string; songTitle: string; artist: string | null; message: string | null; status: string; listenerName: string; createdAt: Date }[];
    }>();
    for (const row of rows) {
      const showId = row.showId as string;
      if (!shows.has(showId)) {
        const startsAt = new Date(row.startsAt as string);
        const endsAt = new Date(row.endsAt as string);
        shows.set(showId, {
          showId,
          programmeName: row.programmeName as string,
          startsAt,
          endsAt,
          live: startsAt <= now && now < endsAt,
          requests: [],
        });
      }
      if (row.id) {
        // Only the first name is shown to the RJ.
        const name = ((row.listenerName as string | null) ?? 'A listener').trim().split(/\s+/)[0];
        shows.get(showId)!.requests.push({
          id: row.id as string,
          songTitle: row.songTitle as string,
          artist: (row.artist as string | null) ?? null,
          message: (row.message as string | null) ?? null,
          status: row.status as string,
          listenerName: name,
          createdAt: new Date(row.createdAt as string),
        });
      }
    }
    return [...shows.values()];
  }

  /** A host marks a request played, skipped, or back to new. */
  async setStatus(listenerId: string, requestId: string, status: unknown, now = new Date()) {
    if (status !== 'played' && status !== 'skipped' && status !== 'new') {
      throw new BadRequestException('Status must be played, skipped or new.');
    }
    const rj = await this.ownRj(listenerId);
    const request = await this.dataSource.manager.findOneBy(SongRequest, { id: requestId });
    if (!request) throw new NotFoundException('Request not found.');
    const hosts = await this.dataSource.manager.existsBy(ShowOccurrenceHost, {
      occurrenceId: request.showOccurrenceId,
      rjId: rj.id,
    });
    if (!hosts) throw new ForbiddenException('Only the RJs hosting this show can handle its requests.');
    if (status === 'played') {
      const show = await this.dataSource.manager.findOneBy(ShowOccurrence, { id: request.showOccurrenceId });
      if (show && show.startsAt.getTime() > now.getTime()) {
        throw new BadRequestException('You can mark a song as played once the show has started. You can skip it any time.');
      }
    }

    request.status = status as SongRequestStatus;
    request.handledByListenerId = status === 'new' ? null : listenerId;
    request.handledAt = status === 'new' ? null : new Date();
    await this.dataSource.manager.save(request);
    return { id: request.id, status: request.status };
  }
}
