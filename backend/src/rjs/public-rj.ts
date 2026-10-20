import type { Rj } from '../rj.entity';

/** Fields of an RJ that are safe to show on public pages. */
export type PublicRj = {
  id: string;
  name: string;
  slug: string;
  photoUrl: string | null;
  isActive: boolean;
  stationId: string | null;
};

/** Strips private fields (email, phone, owner account, verification). */
export function toPublicRj(rj: Rj): PublicRj {
  return {
    id: rj.id,
    name: rj.name,
    slug: rj.slug,
    photoUrl: rj.photoUrl,
    isActive: rj.isActive,
    stationId: rj.stationId,
  };
}
