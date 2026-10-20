import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

type SessionWithReturnTo = Request['session'] & {
  returnTo?: string;
};

export type RequestWithReturnTo = Request & {
  nowrjReturnTo?: string;
};

/**
 * Outbound (/auth/google): stores a safe returnTo path in the session before
 * Passport redirects to Google. The route handler never runs on this leg.
 *
 * Callback (/auth/google/callback): copies returnTo off the session onto the
 * request *before* Passport logs the user in, because Passport 0.7 regenerates
 * the session on login and the saved value would otherwise be lost.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithReturnTo>();
    const session = req.session as SessionWithReturnTo | undefined;

    if (session?.returnTo) {
      req.nowrjReturnTo = session.returnTo;
      delete session.returnTo;
    }

    const returnTo = req.query.returnTo;

    if (
      typeof returnTo === 'string' &&
      returnTo.startsWith('/') &&
      !returnTo.startsWith('//') &&
      !returnTo.includes('\\') &&
      !returnTo.includes('://')
    ) {
      session!.returnTo = returnTo;
    }

    return (await super.canActivate(context)) as boolean;
  }
}
