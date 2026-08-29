/** Mirrors the backend Role enum. Kept as a union so it is usable in types. */
export type Role = 'CUSTOMER' | 'STORE_MANAGER' | 'ADMIN';

export type Language = 'en' | 'ur';

/** The user shape returned by the API (see PublicUser on the backend). */
export interface AuthUser {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  role: Role;
  isActive: boolean;
  preferredLanguage: Language;
  storeId?: string;
  phoneVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SessionResponse {
  user: AuthUser;
  accessToken: string;
}
