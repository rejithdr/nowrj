import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Refuses signed-out requests before anything else runs. Nest runs guards
 * before interceptors, so on upload routes this stops anonymous requests
 * before the file upload (multipart) is read at all.
 */
@Injectable()
export class SignedInGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.isAuthenticated?.()) throw new UnauthorizedException('Please sign in first.');
    return true;
  }
}

/** Tight limits for single-file upload forms: one file and a handful of short fields. */
export const UPLOAD_LIMITS = { files: 1, fields: 5, parts: 6, fieldNameSize: 50, fieldSize: 1024 };
