
import {
  Controller,
  Get,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
  Post,
  Delete,
  Body,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AuthService, GoogleProfile } from './auth.service';
import { AccountService } from './account.service';
import {
  GoogleAuthGuard,
  type RequestWithReturnTo,
} from './guards/google-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly account: AccountService,
  ) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // GoogleAuthGuard saves returnTo and redirects to Google;
    // this handler is never reached on the outbound request.
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const profile = req.user as GoogleProfile;
      const listener =
        await this.authService.findOrCreateGoogleListener(profile);

      req.logIn(listener, (error) => {
        if (error) {
          return res.status(500).send('Unable to create login session.');
        }

        const returnTo = (req as RequestWithReturnTo).nowrjReturnTo;

        const site = (process.env.FRONTEND_URL ?? 'http://localhost:3001').split(',')[0].trim();
        return res.redirect(
          returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
            ? `${site}${returnTo}`
            : site,
        );
      });
    } catch {
      return res.status(500).send('Google sign-in failed.');
    }
  }

  /** Deletes the signed-in person's account and personal data, then signs them out. */
  @Delete('me')
  async deleteMe(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { confirm?: string },
  ) {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedException('Please sign in first.');
    }
    if (body?.confirm !== 'DELETE') {
      throw new BadRequestException('Type DELETE to confirm.');
    }
    const { id } = req.user as { id: string };
    await this.account.deleteAccount(id);
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie('connect.sid', { path: '/' });
        res.status(200).json({ message: 'Your account has been deleted.' });
      });
    });
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    req.logout((error) => {
      if (error) {
        return res.status(500).send('Logout failed.');
      }

      req.session.destroy((sessionError) => {
        if (sessionError) {
          return res.status(500).send('Unable to destroy session.');
        }

        res.clearCookie('connect.sid', { path: '/' });
        return res.status(200).json({ message: 'Logged out successfully.' });
      });
    });
  }

  /** The signed-in person and the roles that decide which dashboards they see. */
  @Get('me')
  async getCurrentListener(@Req() req: Request) {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedException('Please sign in first.');
    }

    const listener = req.user as {
      id: string;
      displayName: string | null;
      photoUrl: string | null;
      email: string | null;
    };

    const [rj] = await this.dataSource.query(
      `SELECT name, slug, "verificationStatus" FROM rjs WHERE "ownerListenerId" = $1`,
      [listener.id],
    );
    const stations: { id: string; name: string; status: string }[] = await this.dataSource.query(
      `SELECT s.id, s.name, ur.status
         FROM user_roles ur JOIN stations s ON s.id = ur."stationId"
        WHERE ur."listenerId" = $1 AND ur.role = 'station_rep' AND ur.status <> 'revoked'
        ORDER BY s.name`,
      [listener.id],
    );
    const admins = (this.config.get<string>('SUPERADMIN_EMAILS') ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const email = listener.email?.trim().toLowerCase();

    return {
      id: listener.id,
      displayName: listener.displayName,
      photoUrl: listener.photoUrl,
      rj: rj ? { name: rj.name, slug: rj.slug, verificationStatus: rj.verificationStatus } : null,
      stations,
      isSuperadmin: Boolean(email && admins.includes(email)),
    };
  }
}
