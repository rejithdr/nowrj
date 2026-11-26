import { BadRequestException } from '@nestjs/common';
import { readParticipationSettings } from './participation-rules';

/** Validated participation settings of a programme (only the fields sent), or a 400. */
export function participationSettings(input: { participation?: unknown; participationPrompt?: unknown }) {
  const out = readParticipationSettings(input);
  if (typeof out === 'string') throw new BadRequestException(out);
  if (out.participationPrompt && /\d{6,}|@|https?:|www\./i.test(out.participationPrompt)) {
    throw new BadRequestException('Keep phone numbers, emails and links out of the invitation text.');
  }
  return out;
}
