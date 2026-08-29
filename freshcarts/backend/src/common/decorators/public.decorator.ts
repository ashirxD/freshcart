import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without authentication.
 * Authentication is ON by default (global JwtAuthGuard); this is the only opt-out.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
