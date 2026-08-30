import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from 'src/common/decorators';

/** Marks the request as one where a missing/invalid token is acceptable. */
const OPTIONAL_AUTH = Symbol('optionalAuth');

type OptionalAuthRequest = Request & { [OPTIONAL_AUTH]?: boolean };

/**
 * Registered globally: every route requires a valid access token unless it is
 * explicitly marked @Public(). Defaulting to "closed" means a forgotten
 * decorator fails safe instead of exposing an endpoint.
 *
 * On @Public() routes authentication is still *attempted*, and the principal is
 * attached when a valid token is present. That is what lets one catalogue
 * endpoint serve anonymous shoppers and admins (who additionally see inactive
 * records) without a parallel set of admin-only read routes. A bad or expired
 * token on a public route is simply ignored — it never turns a browse into a 401.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<OptionalAuthRequest>();
    request[OPTIONAL_AUTH] = isPublic === true;

    if (!isPublic) {
      return (await super.canActivate(context)) as boolean;
    }

    try {
      await super.canActivate(context);
    } catch {
      // Anonymous access is the expected case on a public route.
    }

    return true;
  }

  handleRequest<TUser>(err: Error | null, user: TUser, _info: unknown, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<OptionalAuthRequest>();

    // Public route: attach the principal when there is one, never reject.
    if (request[OPTIONAL_AUTH]) {
      return (user || undefined) as TUser;
    }

    if (err || !user) {
      throw err ?? new UnauthorizedException('Authentication required');
    }

    return user;
  }
}
