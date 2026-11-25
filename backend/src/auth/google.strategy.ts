import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      scope: ['email', 'profile'],
      // A random value kept in the session and checked when Google sends the
      // listener back, so another site can't complete a sign-in for them.
      state: true,
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ) {
    // Use the email only when Google says it is verified: Super Admin access
    // and invitations are matched on it.
    const first = profile.emails?.[0] as { value?: string; verified?: boolean | string } | undefined;
    const verified = first?.verified === true || first?.verified === 'true';
    return {
      googleId: profile.id,
      email: verified && first?.value ? first.value.trim().toLowerCase() : null,
      displayName: profile.displayName || null,
      photoUrl: profile.photos?.[0]?.value ?? null,
    };
  }
}