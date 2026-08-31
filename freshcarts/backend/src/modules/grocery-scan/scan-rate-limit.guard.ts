/**
 * Per-shopper rate limiting for scanning (§41).
 *
 * A scan is not an ordinary request. It uploads megabytes, occupies an OCR
 * engine for seconds, and costs orders of magnitude more than reading a product
 * page — so the global 120-per-minute throttle, which exists to stop request
 * floods, is the wrong instrument entirely.
 *
 * WHY NOT ThrottlerGuard
 *
 * Two reasons, both about this endpoint specifically. It must be keyed by
 * SHOPPER, not by IP: a whole neighbourhood behind one mobile NAT would
 * otherwise share ten scans between them, which is a worse failure than the one
 * being prevented. And the limit must come from configuration, while
 * `@Throttle()` takes its numbers at decoration time, before any config is
 * loaded.
 *
 * WHAT THIS IS NOT
 *
 * Per-process, like the throttler's own default storage. Two API instances
 * allow two windows. That is a real limit and it is stated in the report rather
 * than papered over — the fix is a shared store, which §76 rightly says not to
 * introduce until something needs it.
 */

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AppConfig } from 'src/common/config/configuration';
import type { AuthenticatedUser } from 'src/common/interfaces';

interface Window {
  /** Timestamps of the scans in the current window, oldest first. */
  hits: number[];
}

/** How many trackers to hold before pruning. Bounds memory under abuse. */
const MAX_TRACKED = 10_000;

@Injectable()
export class ScanRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(ScanRateLimitGuard.name);
  private readonly windows = new Map<string, Window>();

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const { rateLimit, rateLimitTtlMs } = this.configService.get('scan', { infer: true });

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const key = this.trackerFor(request);
    const now = Date.now();

    const window = this.windows.get(key) ?? { hits: [] };
    // Sliding window: drop everything older than the period, then measure.
    window.hits = window.hits.filter((at) => now - at < rateLimitTtlMs);

    if (window.hits.length >= rateLimit) {
      const retryAfterMs = rateLimitTtlMs - (now - window.hits[0]);

      this.logger.warn('Scan rate limit reached for ' + key);

      throw new HttpException(
        {
          message:
            'You have scanned a lot of lists in a short time. Please wait ' +
            Math.ceil(retryAfterMs / 60_000) +
            ' minute(s) and try again.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    window.hits.push(now);
    this.windows.set(key, window);
    this.prune(now, rateLimitTtlMs);

    return true;
  }

  /**
   * The shopper, when there is one.
   *
   * Falls back to the IP so the guard still functions if it is ever mounted on
   * an unauthenticated route — but on the scan endpoint the JWT guard has
   * already run, so in practice this is always a user id.
   */
  private trackerFor(request: Request & { user?: AuthenticatedUser }): string {
    const userId = request.user?.userId;
    return userId ? 'user:' + userId : 'ip:' + (request.ip ?? 'unknown');
  }

  /** Forgets windows that have fully expired, so the map cannot grow forever. */
  private prune(now: number, ttlMs: number): void {
    if (this.windows.size < MAX_TRACKED) return;

    for (const [key, window] of this.windows) {
      const newest = window.hits[window.hits.length - 1];
      if (newest === undefined || now - newest >= ttlMs) this.windows.delete(key);
    }
  }
}
