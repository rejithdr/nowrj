import {
  ArgumentsHost,
  Catch,
  Controller,
  Get,
  HttpException,
  Injectable,
  Logger,
  Module,
  Res,
  UseGuards,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';
import { statSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { errorsSince, recentErrors, recordError } from './error-log';

/** The backup script touches this file after every good backup (deploy/backup-db.sh). */
const BACKUP_FILE = process.env.BACKUP_STATUS_FILE ?? '/srv/nowrj/last-backup-ok';
/** A daily backup at 02:30 plus some slack. */
const BACKUP_MAX_AGE_HOURS = 26;

/**
 * Records every server error (5xx) before Nest answers as usual, so the
 * Super Admin and the health check can see them. 4xx answers are not errors.
 */
@Catch()
export class ErrorTrackingFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('ServerError');

  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500 && host.getType() === 'http') {
      const req = host.switchToHttp().getRequest<Request>();
      recordError(exception, req.method, req.originalUrl ?? req.url, status);
      this.logger.error(`${req.method} ${req.originalUrl?.split('?')[0]} -> ${status}`, exception instanceof Error ? exception.stack : String(exception));
    }
    super.catch(exception, host);
  }
}

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async check() {
    const problems: string[] = [];
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
    } catch {
      problems.push('database not answering');
    }

    let lastBackup: string | null = null;
    if (process.env.NODE_ENV === 'production') {
      try {
        const at = statSync(BACKUP_FILE).mtime;
        lastBackup = at.toISOString();
        const hours = (Date.now() - at.getTime()) / 3600_000;
        if (hours > BACKUP_MAX_AGE_HOURS) problems.push(`last good backup ${Math.round(hours)} hours ago`);
      } catch {
        // No backup recorded yet (a new server, before the first 02:30 run).
      }
    }

    const errorsLastHour = errorsSince(3600_000);
    if (errorsLastHour >= 20) problems.push(`${errorsLastHour} server errors in the last hour`);

    return { status: problems.length ? 'problem' : 'ok', problems, lastBackup, errorsLastHour, uptimeMinutes: Math.round(process.uptime() / 60) };
  }
}

/**
 * GET /health          for uptime monitors: 200 when all is well, 503 with the
 *                      problems otherwise (database down, backup missed, error spike).
 * GET /admin/errors    the Super Admin's list of recent server errors.
 */
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  async get(@Res() res: Response) {
    const result = await this.health.check();
    res.setHeader('Cache-Control', 'no-store');
    res.status(result.status === 'ok' ? 200 : 503).json(result);
  }

  @Get('admin/errors')
  @UseGuards(SuperadminGuard)
  errors() {
    return recentErrors();
  }
}

@Module({ controllers: [HealthController], providers: [HealthService] })
export class HealthModule {}
