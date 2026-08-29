import { Role } from 'src/common/enums';

/**
 * The shape attached to `request.user` by the JWT strategy.
 * This is the ONLY trusted source of identity/role in the request lifecycle —
 * never read a role, user id or store id from the request body or headers.
 */
export interface AuthenticatedUser {
  userId: string;
  phone: string;
  role: Role;
  /** Set for STORE_MANAGER accounts; scopes back-office queries to one store. */
  storeId?: string;
}
