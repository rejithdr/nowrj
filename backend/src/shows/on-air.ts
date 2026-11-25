import { BadRequestException } from '@nestjs/common';

/** Which name the RJ may read out with a listener's message. */
export type NameOnAir = 'display' | 'first' | 'none';

/** The consent a listener gives when sending a message, request or question. */
export function readOnAirConsent(input: { nameOnAir?: unknown; okOnAir?: unknown }) {
  const nameOnAir = input.nameOnAir ?? 'display';
  if (nameOnAir !== 'display' && nameOnAir !== 'first' && nameOnAir !== 'none') {
    throw new BadRequestException('Choose which name may be read on air.');
  }
  if (typeof input.okOnAir !== 'boolean') {
    throw new BadRequestException('Say whether this may be read on air.');
  }
  return { nameOnAir: nameOnAir as NameOnAir, okOnAir: input.okOnAir };
}

/** The name the RJ and station see: what the listener agreed may be read out. */
export function onAirName(displayName: string | null, nameOnAir: string | null) {
  const name = (displayName ?? '').trim();
  if (!name || nameOnAir === 'none') return 'A listener';
  return nameOnAir === 'first' ? name.split(/\s+/)[0] : name;
}
