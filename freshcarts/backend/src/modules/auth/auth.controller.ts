import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { AppConfig } from 'src/common/config/configuration';
import { CurrentUser, Public } from 'src/common/decorators';
import { durationToMs } from 'src/common/utils';
import { AuthResult, AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';

export const REFRESH_COOKIE = 'fc_refresh_token';

/**
 * Token transport decision:
 *   - access token  -> response body, held in memory by the client (never localStorage)
 *   - refresh token -> httpOnly cookie, unreadable by JavaScript
 *
 * That combination keeps an XSS bug from yielding a long-lived session, and keeps
 * the short-lived token out of cookie-based CSRF surface.
 */
@Controller('auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService<AppConfig, true>,
  ) {
    const cookie = configService.get('cookie', { infer: true });
    const jwt = configService.get('jwt', { infer: true });
    const apiPrefix = configService.get('apiPrefix', { infer: true });

    this.cookieOptions = {
      httpOnly: true,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      domain: cookie.domain,
      // Scope the cookie to the auth routes so it is not attached to every request.
      path: '/' + apiPrefix.replace(/^\/+/, '') + '/auth',
      maxAge: durationToMs(jwt.refreshExpiresIn),
    };
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.register(dto);
    return this.respondWithSession(result, response);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto);
    return this.respondWithSession(result, response);
  }

  /** Public because the expired access token cannot be used to authorise it. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = (request.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];

    if (!token) {
      throw new UnauthorizedException('No active session');
    }

    const result = await this.authService.refresh(token);
    return this.respondWithSession(result, response);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser('userId') userId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(userId);
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions);
  }

  @Get('me')
  me(@CurrentUser('userId') userId: string) {
    return this.authService.getProfile(userId);
  }

  /** Sets the refresh cookie and returns the body the client is allowed to see. */
  private respondWithSession(result: AuthResult, response: Response) {
    response.cookie(REFRESH_COOKIE, result.refreshToken, this.cookieOptions);
    return { user: result.user, accessToken: result.accessToken };
  }
}
