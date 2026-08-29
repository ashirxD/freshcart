import { Role } from 'src/common/enums';

/** Claims carried by the short-lived access token. */
export interface AccessTokenPayload {
  sub: string;
  phone: string;
  role: Role;
  storeId?: string;
}

/** Claims carried by the refresh token. Deliberately minimal. */
export interface RefreshTokenPayload {
  sub: string;
}

export type SignedPayload<T> = T & { iat: number; exp: number };
