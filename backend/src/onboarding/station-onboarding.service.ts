import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, Not } from 'typeorm';
import { Station } from '../station.entity';
import { StationInvite } from '../station-invite.entity';
import { Rj } from '../rj.entity';
import { UserRole } from '../user-role.entity';
import { clean, EMAIL, PHONE, slugify, writeAudit } from './helpers';

export type JoinInput = {
  mode?: 'new' | 'existing';
  stationId?: string;
  name?: string;
  city?: string;
  state?: string;
  reach?: string;
  contactPhone?: string;
  contactEmail?: string;
};

/** A station joining NowRJ through an RJ's invite link. */
@Injectable()
export class StationOnboardingService {
  constructor(private readonly dataSource: DataSource) {}

  private async findInvite(token: string) {
    const invite = await this.dataSource.manager.findOneBy(StationInvite, { token });
    if (!invite) throw new NotFoundException('This invite link is not valid.');
    return invite;
  }

  /** What the invite page shows. The token itself is the secret. */
  async getInvite(token: string, now = new Date()) {
    const invite = await this.findInvite(token);
    const rj = await this.dataSource.manager.findOneBy(Rj, { id: invite.invitedByRjId });
    const station = invite.stationId
      ? await this.dataSource.manager.findOneBy(Station, { id: invite.stationId })
      : null;
    return {
      stationName: invite.stationName,
      city: invite.city,
      invitedBy: rj?.name ?? 'An RJ',
      status: invite.status,
      expired: invite.expiresAt < now,
      appliedStation: station
        ? { name: station.name, verificationStatus: station.verificationStatus }
        : null,
    };
  }

  async join(listenerId: string, token: string, input: JoinInput, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const invite = await m.findOne(StationInvite, {
        where: { token },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invite) throw new NotFoundException('This invite link is not valid.');
      if (invite.status !== 'sent') throw new GoneException('This invite has already been used.');
      if (invite.expiresAt < now) throw new GoneException('This invite has expired. Ask the RJ for a new one.');
      if (invite.stationId) {
        throw new ConflictException('Someone has already applied with this invite. The NowRJ team is reviewing it.');
      }

      const { station, role } = await this.createApplication(m, listenerId, input);
      invite.stationId = station.id;
      await m.save(invite);

      await writeAudit(m, listenerId, 'station.join_requested', 'station', station.id, {
        inviteId: invite.id,
        roleId: role.id,
        mode: input.mode,
      });

      return { stationId: station.id, stationName: station.name, roleStatus: role.status };
    });
  }

  /**
   * The shared part of applying to represent a station: create a new pending
   * station (or pick a listed one) and a pending representative role.
   */
  private async createApplication(m: EntityManager, listenerId: string, input: JoinInput) {
    let station: Station;
    if (input.mode === 'existing') {
      const found = await m.findOneBy(Station, {
        id: input.stationId ?? '',
        isActive: true,
        verificationStatus: In(['verified', 'legacy']),
      });
      if (!found) throw new NotFoundException('Station not found.');
      station = found;
    } else if (input.mode === 'new') {
      const name = clean(input.name);
      const contactPhone = clean(input.contactPhone);
      const contactEmail = clean(input.contactEmail)?.toLowerCase() ?? null;
      const reach = clean(input.reach);
      if (!name) throw new BadRequestException('Enter the station name.');
      if (name.length > 150) throw new BadRequestException('Station name is too long.');
      if (!contactPhone && !contactEmail) {
        throw new BadRequestException('Give a phone number or email so the NowRJ team can verify the station.');
      }
      if (contactPhone && !PHONE.test(contactPhone)) throw new BadRequestException('Phone number is not valid.');
      if (contactEmail && !EMAIL.test(contactEmail)) throw new BadRequestException('Email is not valid.');
      if (reach && reach !== 'national' && reach !== 'local') {
        throw new BadRequestException('Reach must be national or local.');
      }

      const base = slugify(name, 'station');
      let slug = base;
      for (let n = 2; await m.exists(Station, { where: { slug } }); n++) slug = `${base}-${n}`;

      station = await m.save(
        m.create(Station, {
          name,
          slug,
          city: clean(input.city),
          state: clean(input.state),
          reach: (reach as 'national' | 'local' | null) ?? null,
          contactPhone,
          contactEmail,
          isActive: false,
          verificationStatus: 'pending',
          createdByListenerId: listenerId,
        }),
      );
    } else {
      throw new BadRequestException('Choose a new station or one already on NowRJ.');
    }

    const existingRole = await m.findOneBy(UserRole, {
      listenerId,
      role: 'station_rep',
      stationId: station.id,
      status: Not('revoked'),
    });
    if (existingRole) {
      throw new ConflictException(`You already represent ${station.name} (${existingRole.status}).`);
    }

    const role = await m.save(
      m.create(UserRole, { listenerId, role: 'station_rep', stationId: station.id, status: 'pending' }),
    );
    return { station, role };
  }

  /** A station applying directly from the For stations page, without an RJ's invite. */
  async apply(listenerId: string, input: JoinInput) {
    return this.dataSource.transaction(async (m) => {
      const { station, role } = await this.createApplication(m, listenerId, input);
      await writeAudit(m, listenerId, 'station.application_submitted', 'station', station.id, {
        roleId: role.id,
        mode: input.mode,
      });
      return { stationId: station.id, stationName: station.name, roleStatus: role.status };
    });
  }

  /** The stations this listener represents or has applied to represent. */
  async myStations(listenerId: string) {
    const roles = await this.dataSource.manager.find(UserRole, {
      where: { listenerId, role: 'station_rep', status: Not('revoked') },
      order: { createdAt: 'ASC' },
    });
    if (!roles.length) return [];
    const stations = await this.dataSource.manager.findBy(Station, {
      id: In(roles.map((r) => r.stationId!)),
    });
    return roles.map((role) => {
      const station = stations.find((s) => s.id === role.stationId)!;
      return {
        roleStatus: role.status,
        station: {
          id: station.id,
          name: station.name,
          slug: station.slug,
          city: station.city,
          verificationStatus: station.verificationStatus,
          isActive: station.isActive,
        },
      };
    });
  }
}
