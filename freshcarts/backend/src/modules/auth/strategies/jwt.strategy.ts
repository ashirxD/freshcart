import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from 'src/common/config/configuration';
import { AuthenticatedUser } from 'src/common/interfaces';
import { UsersService } from 'src/modules/users/users.service';
import { AccessTokenPayload } from '../interfaces';

/**
 * Validates the access token and rebuilds the principal FROM THE DATABASE.
 *
 * The token is only used to identify who is asking; the role and store binding
 * are re-read on every request so that a deactivation or demotion takes effect
 * immediately instead of when the token happens to expire.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true }).accessSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is no longer active');
    }

    return {
      userId: user._id.toString(),
      phone: user.phone,
      role: user.role,
      storeId: user.storeId ? user.storeId.toString() : undefined,
    };
  }
}
