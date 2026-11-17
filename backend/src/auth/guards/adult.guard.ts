import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Signed-in people who have not yet confirmed they are 18 or older can read,
 * sign out and answer the question, but cannot change anything.
 * Registered for every route (APP_GUARD in AuthModule).
 */
@Injectable()
export class AdultGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    if (req.path.startsWith('/auth/')) return true;
    if (!req.isAuthenticated?.()) return true;
    const user = req.user as { adultConfirmedAt?: Date | null } | undefined;
    if (user?.adultConfirmedAt) return true;
    throw new ForbiddenException('Please confirm you are 18 or older first. Reload the page to answer.');
  }
}
