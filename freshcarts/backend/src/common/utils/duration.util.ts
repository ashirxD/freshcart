const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Converts a JWT-style duration ("15m", "7d", "3600s") to milliseconds.
 * Used to keep the refresh cookie lifetime in sync with the token lifetime —
 * a cookie that outlives its token produces confusing "silently logged out" bugs.
 */
export function durationToMs(duration: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(duration.trim());

  if (!match) {
    const asSeconds = Number.parseInt(duration, 10);
    if (Number.isNaN(asSeconds)) {
      throw new Error('Unsupported duration format: ' + duration);
    }
    return asSeconds * 1_000;
  }

  return Number.parseInt(match[1], 10) * UNIT_MS[match[2]];
}
