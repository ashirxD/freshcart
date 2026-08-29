/**
 * Application roles. The value is what is persisted and what travels in the JWT,
 * so these strings are part of the API contract — do not rename casually.
 */
export enum Role {
  CUSTOMER = 'CUSTOMER',
  STORE_MANAGER = 'STORE_MANAGER',
  ADMIN = 'ADMIN',
}

export const ALL_ROLES: Role[] = Object.values(Role);

/** Roles that may access back-office (store or platform) functionality. */
export const STAFF_ROLES: Role[] = [Role.STORE_MANAGER, Role.ADMIN];
