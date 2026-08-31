import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from 'src/common/enums';
import { BusinessException } from 'src/common/errors';
import { AuthenticatedUser } from 'src/common/interfaces';

/**
 * STORE SCOPE — the authorization core of this milestone
 * ======================================================
 *
 * Every store-operations request answers one question before it does anything
 * else: *which store may this principal touch?* This module is the only place
 * that answers it.
 *
 * The answer never comes from the request. A `storeId` in a body, a query string
 * or a path is untrusted input, and the whole class of cross-store bugs comes
 * from reading one. It comes from `AuthenticatedUser.storeId`, which the JWT
 * strategy re-reads from the database on every single request — so a manager who
 * is demoted or moved to another store loses access on their next call, not when
 * their token happens to expire.
 *
 * Callers receive an ObjectId and are expected to put it *in the query filter*,
 * not compare it after loading a document. "Find the order with this id AND this
 * storeId" cannot leak; "find the order, then check its store" can, the first
 * time someone forgets the second half.
 */

/** The resolved scope for one request. */
export interface StoreScope {
  storeId: Types.ObjectId;
  /** The acting user, for audit attribution. Never taken from a request body. */
  actorId: Types.ObjectId;
  actorRole: Role;
}

/**
 * Resolves the store a store manager is bound to.
 *
 * Fails closed: a STORE_MANAGER with no binding gets a 403, never a silent
 * fallback to the default store. Falling back would be the worst possible
 * outcome — a manager quietly handed another shop's orders, with every
 * downstream query looking perfectly correct.
 */
export function resolveManagerStoreId(user: AuthenticatedUser): Types.ObjectId {
  if (user.role !== Role.STORE_MANAGER) {
    throw new ForbiddenException('This area is for store staff.');
  }

  if (!user.storeId || !Types.ObjectId.isValid(user.storeId)) {
    throw BusinessException.storeNotAssigned();
  }

  return new Types.ObjectId(user.storeId);
}

/**
 * Verifies a principal may act on a store they named.
 *
 * Used where an endpoint legitimately carries a store id — nothing in this
 * milestone does, deliberately, but the check exists so that the first endpoint
 * which needs one has an obvious correct thing to call rather than inventing a
 * comparison inline.
 */
export function assertStoreAccess(user: AuthenticatedUser, requestedStoreId: string): void {
  if (user.role === Role.ADMIN) return;

  if (user.role !== Role.STORE_MANAGER || !user.storeId) {
    throw new ForbiddenException('You do not have access to this store.');
  }

  if (user.storeId !== requestedStoreId) {
    // Deliberately the same wording as the no-access case: confirming that a
    // store id exists but belongs to somebody else is itself a small leak.
    throw new ForbiddenException('You do not have access to this store.');
  }
}
