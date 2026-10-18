import {
  Controller,
  Get,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
    Post,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService, GoogleProfile } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
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

        return res.redirect('http://localhost:3001');
      });
    } catch {
      return res.status(500).send('Google sign-in failed.');
    }
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
  @Get('me')
  getCurrentListener(@Req() req: Request) {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedException('Please sign in first.');
    }

    const listener = req.user as {
      id: string;
      displayName: string | null;
      photoUrl: string | null;
    };

    return {
      id: listener.id,
      displayName: listener.displayName,
      photoUrl: listener.photoUrl,
    };
  }
}