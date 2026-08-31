import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from 'src/common/enums';
import { BusinessException } from 'src/common/errors';
import { AuthenticatedUser } from 'src/common/interfaces';
import { assertStoreAccess, resolveManagerStoreId } from './store-scope';

const STORE_A = '64b000000000000000000001';
const STORE_B = '64b000000000000000000002';

function principal(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: '64b000000000000000000009',
    phone: '+923001234568',
    role: Role.STORE_MANAGER,
    storeId: STORE_A,
    ...overrides,
  };
}

/**
 * The authorization core. Every store-operations request passes through here, so
 * these are the tests that decide whether cross-store access is possible at all.
 */
describe('resolveManagerStoreId', () => {
  it('returns the store the manager is bound to', () => {
    expect(resolveManagerStoreId(principal())).toEqual(new Types.ObjectId(STORE_A));
  });

  it('never consults anything but the principal', () => {
    // The point stated as a test: the only input is the verified principal, so
    // there is no request-shaped argument that could carry a different store.
    expect(resolveManagerStoreId.length).toBe(1);
  });

  it('rejects a customer', () => {
    expect(() => resolveManagerStoreId(principal({ role: Role.CUSTOMER }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects an admin, who has no store binding', () => {
    // Admins are deliberately not given the store surface: "their store" would
    // have to mean the configured default, which is a single-store assumption.
    expect(() =>
      resolveManagerStoreId(principal({ role: Role.ADMIN, storeId: undefined })),
    ).toThrow(ForbiddenException);
  });

  it('fails closed for a manager with no store, rather than defaulting', () => {
    // The dangerous alternative would be falling back to the active store, which
    // would silently hand this manager another shop's orders.
    let caught: unknown;
    try {
      resolveManagerStoreId(principal({ storeId: undefined }));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe('STORE_NOT_ASSIGNED');
  });

  it('fails closed for a malformed store id', () => {
    expect(() => resolveManagerStoreId(principal({ storeId: 'not-an-object-id' }))).toThrow(
      BusinessException,
    );
  });
});

describe('assertStoreAccess', () => {
  it('allows a manager acting on their own store', () => {
    expect(() => assertStoreAccess(principal(), STORE_A)).not.toThrow();
  });

  it('refuses a manager naming another store', () => {
    expect(() => assertStoreAccess(principal(), STORE_B)).toThrow(ForbiddenException);
  });

  it('gives the same message whether the store exists or not', () => {
    // Confirming that a store id is real but belongs to somebody else is itself
    // a small leak, so both cases read identically.
    const unknownStore = () => assertStoreAccess(principal(), '64b0000000000000000000ff');
    const otherStore = () => assertStoreAccess(principal(), STORE_B);

    let first = '';
    let second = '';
    try {
      unknownStore();
    } catch (error) {
      first = (error as Error).message;
    }
    try {
      otherStore();
    } catch (error) {
      second = (error as Error).message;
    }

    expect(first).toBe(second);
  });

  it('refuses a customer outright', () => {
    expect(() => assertStoreAccess(principal({ role: Role.CUSTOMER }), STORE_A)).toThrow(
      ForbiddenException,
    );
  });

  it('lets an admin through to any store', () => {
    expect(() =>
      assertStoreAccess(principal({ role: Role.ADMIN, storeId: undefined }), STORE_B),
    ).not.toThrow();
  });
});
