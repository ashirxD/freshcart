import { SetMetadata } from '@nestjs/common';
import { Role } from 'src/common/enums';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route (or controller) to the listed roles.
 * Enforced by the global RolesGuard against the JWT-derived role only.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
