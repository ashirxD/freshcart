import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/common/config/configuration';
import { Role } from 'src/common/enums';
import { ScanRateLimitGuard } from './scan-rate-limit.guard';

/**
 * §41: scanning is the expensive endpoint, so it gets its own limit — and that
 * limit is per shopper, not per IP.
 */

const LIMIT = 3;
const WINDOW_MS = 60_000;

function guard(limit = LIMIT, ttlMs = WINDOW_MS) {
  const configService = {
    get: () => ({ maxImageBytes: 1024, rateLimit: limit, rateLimitTtlMs: ttlMs }),
  } as unknown as ConfigService<AppConfig, true>;

  return new ScanRateLimitGuard(configService);
}

function context(user: { userId: string } | undefined, ip = '10.0.0.1'): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip,
        user: user ? { ...user, phone: '+923001234569', role: Role.CUSTOMER } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ScanRateLimitGuard', () => {
  it('allows scans up to the configured limit', () => {
    const subject = guard();
    const request = context({ userId: 'user-1' });

    for (let attempt = 0; attempt < LIMIT; attempt += 1) {
      expect(subject.canActivate(request)).toBe(true);
    }
  });

  it('refuses the one after that, with a wait the shopper can act on', () => {
    const subject = guard();
    const request = context({ userId: 'user-1' });

    for (let attempt = 0; attempt < LIMIT; attempt += 1) subject.canActivate(request);

    try {
      subject.canActivate(request);
      throw new Error('expected the guard to refuse');
    } catch (error) {
      const failure = error as {
        getStatus?: () => number;
        getResponse?: () => { message: string };
      };
      expect(failure.getStatus?.()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(failure.getResponse?.().message).toMatch(/wait \d+ minute/i);
    }
  });

  it('counts each shopper separately', () => {
    // The reason this is not ThrottlerGuard: keyed by IP, a whole
    // neighbourhood behind one mobile NAT would share the allowance.
    const subject = guard();
    const sharedIp = '203.0.113.7';

    for (let attempt = 0; attempt < LIMIT; attempt += 1) {
      subject.canActivate(context({ userId: 'user-1' }, sharedIp));
    }

    expect(subject.canActivate(context({ userId: 'user-2' }, sharedIp))).toBe(true);
  });

  it('lets the window slide, so a shopper is not locked out forever', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-31T10:00:00Z'));

    try {
      const subject = guard();
      const request = context({ userId: 'user-1' });

      for (let attempt = 0; attempt < LIMIT; attempt += 1) subject.canActivate(request);
      expect(() => subject.canActivate(request)).toThrow();

      jest.setSystemTime(new Date('2026-08-31T10:01:01Z'));
      expect(subject.canActivate(request)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to the IP when there is no authenticated shopper', () => {
    const subject = guard(1);

    expect(subject.canActivate(context(undefined, '10.0.0.9'))).toBe(true);
    expect(() => subject.canActivate(context(undefined, '10.0.0.9'))).toThrow();
    expect(subject.canActivate(context(undefined, '10.0.0.10'))).toBe(true);
  });
});
