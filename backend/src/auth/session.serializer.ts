import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { ListenersService } from '../listeners/listeners.service';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly listenersService: ListenersService) {
    super();
  }

  serializeUser(
    user: { id: string },
    done: (error: Error | null, id?: string) => void,
  ): void {
    done(null, user.id);
  }

  async deserializeUser(
    id: string,
    done: (error: Error | null, user?: unknown) => void,
  ): Promise<void> {
    try {
      const listener = await this.listenersService.findByIdForAuth(id);
      done(null, listener ?? false);
    } catch (error) {
      done(error instanceof Error ? error : new Error(String(error)));
    }
  }
}