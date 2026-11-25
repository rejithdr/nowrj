import { Injectable } from '@nestjs/common';
import { ListenersService } from '../listeners/listeners.service';

export interface GoogleProfile {
  googleId: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
}

@Injectable()
export class AuthService {
  constructor(private readonly listenersService: ListenersService) {}

  async findOrCreateGoogleListener(profile: GoogleProfile) {
    const existing = await this.listenersService.findByGoogleId(
      profile.googleId,
    );

    if (existing) {
      // Keep the stored email in step with Google's current, verified one, so
      // access tied to an email follows the address the person really holds.
      if (existing.email !== profile.email) {
        return this.listenersService.updateEmail(existing.id, profile.email);
      }
      return existing;
    }

    return this.listenersService.create({
      googleId: profile.googleId,
      email: profile.email,
      displayName: profile.displayName,
      photoUrl: profile.photoUrl,
    });
  }
}