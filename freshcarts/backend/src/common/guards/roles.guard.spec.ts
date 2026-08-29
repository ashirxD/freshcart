import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from 'src/common/enums';
import { AuthenticatedUser } from 'src/common/interfaces';
import { RolesGuard } from './roles.guard';

function contextFor(user?: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function guardWithRequiredRoles(roles: Role[] | undefined): RolesGuard {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(roles) } as unknown as Reflector;
  return new RolesGuard(reflector);
}

const customer: AuthenticatedUser = {
  userId: 'u1',
  phone: '+923001234567',
  role: Role.CUSTOMER,
};

const admin: AuthenticatedUser = { ...customer, role: Role.ADMIN };
const manager: AuthenticatedUser = { ...customer, role: Role.STORE_MANAGER, storeId: 's1' };

describe('RolesGuard', () => {
  it('allows a route with no @Roles() metadata', () => {
    expect(guardWithRequiredRoles(undefined).canActivate(contextFor(customer))).toBe(true);
  });

  it('allows a route with an empty role list', () => {
    expect(guardWithRequiredRoles([]).canActivate(contextFor(customer))).toBe(true);
  });

  it('allows a user whose role is listed', () => {
    expect(guardWithRequiredRoles([Role.ADMIN]).canActivate(contextFor(admin))).toBe(true);
  });

  it('allows any of several permitted roles', () => {
    const guard = guardWithRequiredRoles([Role.ADMIN, Role.STORE_MANAGER]);
    expect(guard.canActivate(contextFor(manager))).toBe(true);
  });

  it('rejects a customer reaching an admin-only route', () => {
    const guard = guardWithRequiredRoles([Role.ADMIN]);
    expect(() => guard.canActivate(contextFor(customer))).toThrow(ForbiddenException);
  });

  it('rejects a store manager reaching an admin-only route', () => {
    const guard = guardWithRequiredRoles([Role.ADMIN]);
    expect(() => guard.canActivate(contextFor(manager))).toThrow(ForbiddenException);
  });

  it('rejects an unauthenticated request rather than defaulting to allow', () => {
    const guard = guardWithRequiredRoles([Role.ADMIN]);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });
});
