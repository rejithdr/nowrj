import { ForbiddenException } from '@nestjs/common';

export { RJ_CAN_ACT } from './rj-can-act';

export const RJ_SUSPENDED_MESSAGE =
  'Your RJ profile is suspended by the NowRJ team, so RJ tools are off. Contact nowonfmindia@gmail.com if you think this is a mistake.';

export function assertRjCanAct<T extends { suspendedAt?: Date | null; verificationStatus?: string } | null>(rj: T): T {
  if (rj && (rj.suspendedAt || rj.verificationStatus === 'rejected' || rj.verificationStatus === 'deleted')) {
    throw new ForbiddenException(RJ_SUSPENDED_MESSAGE);
  }
  return rj;
}
