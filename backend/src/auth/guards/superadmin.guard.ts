
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

type AuthenticatedListener = {
  email?: string | null;
};

type AuthenticatedRequest = Request & {
  user?: AuthenticatedListener;
  isAuthenticated?: () => boolean;
};

@Injectable()
export class SuperadminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.isAuthenticated?.() || !request.user) {
      throw new UnauthorizedException('Please sign in first.');
    }

    const email = request.user.email?.trim().toLowerCase();
    const configuredEmails = this.configService
      .get<string>('SUPERADMIN_EMAILS')
      ?.split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (!email || !configuredEmails?.length) {
      throw new ForbiddenException('Superadmin access is not configured.');
    }

    if (!configuredEmails.includes(email)) {
      throw new ForbiddenException('Superadmin access required.');
    }

    return true;
  }
}
