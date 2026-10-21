import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { DataSource } from 'typeorm';

const MAX_BYTES = 1024 * 1024;

/** Where the backend can be reached from a browser, for building photo links. */
function publicApiUrl(): string {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') {
    const site = (process.env.FRONTEND_URL ?? '').split(',')[0].trim().replace(/\/$/, '');
    return `${site}/api`;
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/** Recognises JPEG, PNG and WebP by their first bytes, not by the file name. */
function imageType(data: Buffer): string | null {
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (data.length > 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

type UploadedImage = { buffer: Buffer; size: number };

@Injectable()
export class RjPhotosService {
  constructor(private readonly dataSource: DataSource) {}

  private async ownRjId(listenerId: string): Promise<string> {
    const [rj] = await this.dataSource.query(`SELECT id FROM rjs WHERE "ownerListenerId" = $1`, [listenerId]);
    if (!rj) throw new NotFoundException('RJ profile not found.');
    return rj.id;
  }

  async upload(listenerId: string, file: UploadedImage | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose a photo to upload.');
    if (file.size > MAX_BYTES) throw new BadRequestException('That photo is too large. Please use one under 1 MB.');
    const contentType = imageType(file.buffer);
    if (!contentType) throw new BadRequestException('Please upload a JPEG, PNG or WebP photo.');

    const rjId = await this.ownRjId(listenerId);
    const photoUrl = `${publicApiUrl()}/rjs/${rjId}/photo?v=${Date.now()}`;
    await this.dataSource.transaction(async (m) => {
      await m.query(
        `INSERT INTO rj_photos ("rjId", data, "contentType", "updatedAt") VALUES ($1, $2, $3, now())
         ON CONFLICT ("rjId") DO UPDATE SET data = EXCLUDED.data, "contentType" = EXCLUDED."contentType", "updatedAt" = now()`,
        [rjId, file.buffer, contentType],
      );
      await m.query(`UPDATE rjs SET "photoUrl" = $2 WHERE id = $1`, [rjId, photoUrl]);
    });
    return { photoUrl };
  }

  async remove(listenerId: string) {
    const rjId = await this.ownRjId(listenerId);
    await this.dataSource.transaction(async (m) => {
      await m.query(`DELETE FROM rj_photos WHERE "rjId" = $1`, [rjId]);
      await m.query(`UPDATE rjs SET "photoUrl" = NULL WHERE id = $1`, [rjId]);
    });
    return { photoUrl: null };
  }

  async find(rjId: string): Promise<{ data: Buffer; contentType: string } | null> {
    const [row] = await this.dataSource.query(
      `SELECT p.data, p."contentType" FROM rj_photos p JOIN rjs r ON r.id = p."rjId"
        WHERE p."rjId" = $1 AND r."verificationStatus" <> 'deleted'`,
      [rjId],
    );
    return row ?? null;
  }
}

function listenerId(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}

/** Upload or remove your own photo: /rjs/me/photo. */
@Controller('rjs/me/photo')
export class RjOwnPhotoController {
  constructor(private readonly photos: RjPhotosService) {}

  @Post()
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_BYTES, files: 1 } }))
  upload(@Req() req: Request, @UploadedFile() file: UploadedImage | undefined) {
    return this.photos.upload(listenerId(req), file);
  }

  @Delete()
  remove(@Req() req: Request) {
    return this.photos.remove(listenerId(req));
  }
}

/** Public photo: /rjs/:id/photo. Links carry a version, so browsers may cache them for a year. */
@Controller('rjs')
export class RjPhotoController {
  constructor(private readonly photos: RjPhotosService) {}

  @Get(':id/photo')
  async show(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const photo = await this.photos.find(id);
    if (!photo) throw new NotFoundException('No photo.');
    res.set({
      'Content-Type': photo.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(photo.data);
  }
}
