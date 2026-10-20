import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { Rj } from '../rj.entity';
import { Station } from '../station.entity';
import { Programme } from '../programme.entity';
import { ProgrammeRj } from '../programme-rj.entity';
import { ProgrammeOwnership } from '../programme-ownership.entity';
import { RjStationAffiliation } from '../rj-station-affiliation.entity';
import { StationInvite } from '../station-invite.entity';
import { ProgrammeSchedule } from '../programme-schedule.entity';
import {
  describeDays,
  normaliseSlot,
  Slot,
  SlotInput,
  slotsOverlap,
} from '../programmes/schedule-rules';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^\+?[0-9][0-9 -]{5,18}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SetStationInput = { stationId?: string; joinedOn?: string };
export type InviteInput = {
  stationName?: string;
  city?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};
export type ProgrammeInput = {
  name?: string;
  stationId?: string | null;
  stationInviteId?: string | null;
  /** One or more time slots: days of the week plus start and end time. */
  schedule?: SlotInput[];
  callInPhone?: string | null;
};

/** Weekday order: earliest first day, then earliest start time. */
function bySlotOrder(
  a: { daysOfWeek: number[]; startTime: string },
  b: { daysOfWeek: number[]; startTime: string },
) {
  return Math.min(...a.daysOfWeek) - Math.min(...b.daysOfWeek) || a.startTime.localeCompare(b.startTime);
}

function parseSlots(inputs: SlotInput[] | undefined): Slot[] {
  const slots: Slot[] = [];
  for (const [index, input] of (inputs ?? []).entries()) {
    const slot = normaliseSlot(input ?? {});
    if (typeof slot === 'string') {
      throw new BadRequestException(inputs!.length > 1 ? `Time slot ${index + 1}: ${slot}` : slot);
    }
    const clash = slots.findIndex((other) => slotsOverlap(slot, other));
    if (clash >= 0) {
      throw new BadRequestException(`Time slots ${clash + 1} and ${index + 1} overlap.`);
    }
    slots.push(slot);
  }
  return slots;
}

/** Today's date in India, as YYYY-MM-DD. */
export function todayInIndia(now = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function checkPhone(value: string | null, label: string) {
  if (value && !PHONE.test(value)) {
    throw new BadRequestException(`${label} must be 6 to 19 digits, optionally starting with +.`);
  }
}

/**
 * Everything an RJ manages from their own dashboard. Every method starts
 * from the signed-in listener and only touches that listener's RJ profile.
 */
@Injectable()
export class RjDashboardService {
  constructor(private readonly dataSource: DataSource) {}

  private async ownRj(listenerId: string, manager: EntityManager = this.dataSource.manager) {
    const rj = await manager.findOne(Rj, {
      where: { ownerListener: { id: listenerId } },
    });
    if (!rj) {
      throw new NotFoundException('Register your RJ profile first.');
    }
    return rj;
  }

  // ---------------------------------------------------------------- station

  async getStationHistory(listenerId: string) {
    const rj = await this.ownRj(listenerId);
    const rows = await this.dataSource.manager.find(RjStationAffiliation, {
      where: { rjId: rj.id },
      relations: { station: true },
      order: { joinedOn: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((row) => ({
      id: row.id,
      stationId: row.stationId,
      stationName: row.station.name,
      joinedOn: row.joinedOn,
      leftOn: row.leftOn,
      verificationStatus: row.verificationStatus,
      current: row.leftOn === null,
    }));
  }

  /**
   * Sets the RJ's current station. Any current station is closed the day
   * before the new joining date, so the history reads like a CV.
   */
  async setStation(listenerId: string, input: SetStationInput) {
    const joinedOn = input.joinedOn?.trim() || todayInIndia();
    if (!DATE.test(joinedOn) || Number.isNaN(Date.parse(joinedOn))) {
      throw new BadRequestException('Joining date must be a valid date.');
    }
    if (joinedOn > todayInIndia()) {
      throw new BadRequestException('Joining date cannot be in the future.');
    }
    if (!input.stationId) {
      throw new BadRequestException('Choose a station.');
    }

    return this.dataSource.transaction(async (manager) => {
      const rj = await this.ownRj(listenerId, manager);
      const station = await manager.findOne(Station, {
        where: { id: input.stationId, isActive: true },
      });
      if (!station) {
        throw new NotFoundException('Station not found.');
      }

      const current = await manager.findOne(RjStationAffiliation, {
        where: { rjId: rj.id, leftOn: IsNull() },
      });

      if (current) {
        if (current.stationId === station.id) {
          throw new ConflictException(`${station.name} is already your current station.`);
        }
        if (joinedOn <= current.joinedOn) {
          throw new BadRequestException(
            `The new joining date must be after ${current.joinedOn}, when you joined your current station.`,
          );
        }
        current.leftOn = dayBefore(joinedOn);
        await manager.save(current);
      }

      const created = await manager.save(
        manager.create(RjStationAffiliation, {
          rjId: rj.id,
          stationId: station.id,
          joinedOn,
          leftOn: null,
          verificationStatus: 'pending',
        }),
      );

      // rjs.stationId stays as a shortcut to the current station.
      await manager.update(Rj, { id: rj.id }, { stationId: station.id });

      return {
        id: created.id,
        stationId: station.id,
        stationName: station.name,
        joinedOn,
        previousLeftOn: current?.leftOn ?? null,
      };
    });
  }

  // ---------------------------------------------------------------- invites

  async listInvites(listenerId: string) {
    const rj = await this.ownRj(listenerId);
    const invites = await this.dataSource.manager.find(StationInvite, {
      where: { invitedByRjId: rj.id },
      order: { createdAt: 'DESC' },
    });
    return invites.map((invite) => ({
      id: invite.id,
      stationName: invite.stationName,
      city: invite.city,
      contactName: invite.contactName,
      contactPhone: invite.contactPhone,
      contactEmail: invite.contactEmail,
      status: invite.status,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    }));
  }

  async createInvite(listenerId: string, input: InviteInput) {
    const stationName = clean(input.stationName);
    const contactPhone = clean(input.contactPhone);
    const contactEmail = clean(input.contactEmail)?.toLowerCase() ?? null;

    if (!stationName) {
      throw new BadRequestException('Enter the station name.');
    }
    if (stationName.length > 150) {
      throw new BadRequestException('Station name is too long.');
    }
    if (!contactPhone && !contactEmail) {
      throw new BadRequestException('Give a phone number or email for someone at the station.');
    }
    checkPhone(contactPhone, 'Contact phone');
    if (contactEmail && !EMAIL.test(contactEmail)) {
      throw new BadRequestException('Contact email is not valid.');
    }

    const rj = await this.ownRj(listenerId);

    const duplicate = await this.dataSource.manager
      .createQueryBuilder(StationInvite, 'invite')
      .where('invite.invitedByRjId = :rjId', { rjId: rj.id })
      .andWhere('invite.status = :status', { status: 'sent' })
      .andWhere('lower(invite.stationName) = lower(:name)', { name: stationName })
      .getOne();
    if (duplicate) {
      throw new ConflictException(`You already have an open invite to ${duplicate.stationName}.`);
    }

    const invite = await this.dataSource.manager.save(
      this.dataSource.manager.create(StationInvite, {
        invitedByRjId: rj.id,
        stationName,
        city: clean(input.city),
        contactName: clean(input.contactName),
        contactPhone,
        contactEmail,
        token: randomBytes(24).toString('hex'),
        status: 'sent',
      }),
    );

    return { id: invite.id, stationName: invite.stationName, status: invite.status };
  }

  // ------------------------------------------------------------- programmes

  async listProgrammes(listenerId: string) {
    const rj = await this.ownRj(listenerId);
    const rows = await this.dataSource.manager
      .createQueryBuilder(Programme, 'p')
      .leftJoin(Station, 's', 's.id = p.stationId')
      .leftJoin(StationInvite, 'i', 'i.id = p.stationInviteId')
      .leftJoin(Station, 'os', 'os.id = p.ownerStationId')
      .where(
        'p.createdByRjId = :rjId OR EXISTS (SELECT 1 FROM programme_rjs pr WHERE pr."programmeId" = p.id AND pr."rjId" = :rjId)',
        { rjId: rj.id },
      )
      .select([
        'p.id AS id',
        'p.name AS name',
        'p.slug AS slug',
        'p.startTime AS "startTime"',
        'p.endTime AS "endTime"',
        'p.callInPhone AS "callInPhone"',
        'p.isActive AS "isActive"',
        's.name AS "stationName"',
        'i.stationName AS "invitedStationName"',
        'i.status AS "inviteStatus"',
        'p.ownerRjId AS "ownerRjId"',
        'os.name AS "ownerStationName"',
      ])
      .orderBy('p.createdAt', 'DESC')
      .getRawMany<{
        id: string;
        name: string;
        slug: string;
        startTime: string | null;
        endTime: string | null;
        callInPhone: string | null;
        isActive: boolean;
        stationName: string | null;
        invitedStationName: string | null;
        inviteStatus: string | null;
        ownerRjId: string | null;
        ownerStationName: string | null;
      }>();

    const slots = rows.length
      ? await this.dataSource.manager.find(ProgrammeSchedule, {
          where: rows.map((row) => ({ programmeId: row.id, validTo: IsNull() })),
          order: { createdAt: 'ASC' },
        })
      : [];

    return rows.map(({ ownerRjId, ...row }) => ({
      ...row,
      ownedByYou: ownerRjId === rj.id,
      schedule: slots
        .filter((slot) => slot.programmeId === row.id)
        .sort(bySlotOrder)
        .map((slot) => ({
          id: slot.id,
          days: slot.daysOfWeek,
          startTime: slot.startTime.slice(0, 5),
          endTime: slot.endTime.slice(0, 5),
          label: `${describeDays(slot.daysOfWeek)} ${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)}`,
        })),
    }));
  }

  /**
   * Creates a programme owned by the RJ, on their current station or on a
   * station they have invited. The RJ is recorded as host, creator and
   * first owner.
   */
  async createProgramme(listenerId: string, input: ProgrammeInput) {
    const name = clean(input.name);
    const slots = parseSlots(input.schedule);
    const [firstSlot] = [...slots].sort((a, b) =>
      bySlotOrder({ daysOfWeek: a.days, startTime: a.startTime }, { daysOfWeek: b.days, startTime: b.startTime }),
    );
    const callInPhone = clean(input.callInPhone);
    const stationId = clean(input.stationId);
    const stationInviteId = clean(input.stationInviteId);

    if (!name) {
      throw new BadRequestException('Enter the programme name.');
    }
    if (name.length > 150) {
      throw new BadRequestException('Programme name is too long.');
    }
    if (Boolean(stationId) === Boolean(stationInviteId)) {
      throw new BadRequestException('Choose your station or one of your station invites.');
    }
    checkPhone(callInPhone, 'Call-in number');

    return this.dataSource.transaction(async (manager) => {
      const rj = await this.ownRj(listenerId, manager);

      if (stationId) {
        const current = await manager.findOne(RjStationAffiliation, {
          where: { rjId: rj.id, leftOn: IsNull() },
        });
        if (!current || current.stationId !== stationId) {
          throw new ForbiddenException('You can only add programmes on your current station.');
        }
      } else {
        const invite = await manager.findOne(StationInvite, {
          where: { id: stationInviteId!, invitedByRjId: rj.id },
        });
        if (!invite || invite.status !== 'sent') {
          throw new ForbiddenException('That station invite is not open.');
        }
      }

      const base =
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140) ||
        'programme';
      let slug = base;
      for (let n = 2; await manager.exists(Programme, { where: { slug } }); n++) {
        slug = `${base}-${n}`;
      }

      const programme = await manager.save(
        manager.create(Programme, {
          name,
          slug,
          rjName: rj.name,
          startTime: firstSlot?.startTime ?? null,
          endTime: firstSlot?.endTime ?? null,
          callInPhone,
          stationId: stationId ?? null,
          stationInviteId: stationInviteId ?? null,
          createdByRjId: rj.id,
          ownerRjId: rj.id,
          ownerStationId: null,
          // Hidden from the public until the RJ is verified.
          isActive: ['verified', 'legacy'].includes(rj.verificationStatus),
        }),
      );

      await manager.save(manager.create(ProgrammeRj, { programmeId: programme.id, rjId: rj.id }));

      for (const slot of slots) {
        await manager.save(
          manager.create(ProgrammeSchedule, {
            programmeId: programme.id,
            daysOfWeek: slot.days,
            startTime: slot.startTime,
            endTime: slot.endTime,
            validFrom: todayInIndia(),
            validTo: null,
          }),
        );
      }

      await manager.save(
        manager.create(ProgrammeOwnership, {
          programmeId: programme.id,
          ownerRjId: rj.id,
          ownerStationId: null,
          validFrom: new Date(),
          reason: 'created',
          changedByListenerId: listenerId,
        }),
      );

      return { id: programme.id, name: programme.name, slug: programme.slug, isActive: programme.isActive };
    });
  }

  private async assertHost(
    listenerId: string,
    programmeId: string,
    what: string,
    manager: EntityManager = this.dataSource.manager,
  ) {
    const rj = await this.ownRj(listenerId, manager);
    const hosts = await manager.exists(ProgrammeRj, { where: { programmeId, rjId: rj.id } });
    if (!hosts) {
      throw new ForbiddenException(`Only the programme’s hosts can change its ${what}.`);
    }
    return rj;
  }

  /** Hosting RJs may change a programme's call-in number. */
  async updateCallIn(listenerId: string, programmeId: string, callInPhoneInput: string | null | undefined) {
    const callInPhone = clean(callInPhoneInput);
    checkPhone(callInPhone, 'Call-in number');
    await this.assertHost(listenerId, programmeId, 'call-in number');
    await this.dataSource.manager.update(Programme, { id: programmeId }, { callInPhone });
    return { id: programmeId, callInPhone };
  }

  /** Keeps programmes.startTime/endTime (used by older pages) on the first current slot in weekday order. */
  private async syncProgrammeTimes(manager: EntityManager, programmeId: string) {
    const [first] = (
      await manager.find(ProgrammeSchedule, { where: { programmeId, validTo: IsNull() } })
    ).sort(bySlotOrder);
    await manager.update(
      Programme,
      { id: programmeId },
      { startTime: first?.startTime ?? null, endTime: first?.endTime ?? null },
    );
  }

  /** Adds a time slot from today. It may not overlap the programme's current slots. */
  async addSlot(listenerId: string, programmeId: string, input: SlotInput) {
    const [slot] = parseSlots([input ?? {}]);

    return this.dataSource.transaction(async (manager) => {
      await this.assertHost(listenerId, programmeId, 'schedule', manager);
      const current = await manager.find(ProgrammeSchedule, {
        where: { programmeId, validTo: IsNull() },
      });
      const clash = current.find((other) =>
        slotsOverlap(slot, {
          days: other.daysOfWeek,
          startTime: other.startTime.slice(0, 5),
          endTime: other.endTime.slice(0, 5),
        }),
      );
      if (clash) {
        throw new ConflictException(
          `This overlaps ${describeDays(clash.daysOfWeek)} ${clash.startTime.slice(0, 5)}–${clash.endTime.slice(0, 5)}. Remove that slot first.`,
        );
      }

      const saved = await manager.save(
        manager.create(ProgrammeSchedule, {
          programmeId,
          daysOfWeek: slot.days,
          startTime: slot.startTime,
          endTime: slot.endTime,
          validFrom: todayInIndia(),
          validTo: null,
        }),
      );
      await this.syncProgrammeTimes(manager, programmeId);
      return { id: saved.id, label: `${describeDays(slot.days)} ${slot.startTime}–${slot.endTime}` };
    });
  }

  /**
   * Stops a time slot from today. A slot added today is simply removed;
   * an older one is kept as history with yesterday as its last day.
   */
  async endSlot(listenerId: string, programmeId: string, slotId: string) {
    return this.dataSource.transaction(async (manager) => {
      await this.assertHost(listenerId, programmeId, 'schedule', manager);
      const slot = await manager.findOne(ProgrammeSchedule, {
        where: { id: slotId, programmeId, validTo: IsNull() },
      });
      if (!slot) {
        throw new NotFoundException('Time slot not found.');
      }

      const today = todayInIndia();
      if (slot.validFrom >= today) {
        await manager.delete(ProgrammeSchedule, { id: slot.id });
      } else {
        slot.validTo = dayBefore(today);
        await manager.save(slot);
      }
      await this.syncProgrammeTimes(manager, programmeId);
      return { id: slot.id, ended: true };
    });
  }
}
