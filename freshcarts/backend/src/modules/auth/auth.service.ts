import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppConfig } from 'src/common/config/configuration';
import { Role } from 'src/common/enums';
import { PasswordService } from 'src/common/security';
import { PublicUser, UsersService } from 'src/modules/users/users.service';
import { UserDocument } from 'src/modules/users/schemas';
import { LoginDto, RegisterDto } from './dto';
import { AccessTokenPayload, RefreshTokenPayload } from './interfaces';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly jwtConfig: AppConfig['jwt'];

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.jwtConfig = configService.get('jwt', { infer: true });
  }

  /**
   * Public self-registration. The role is hard-coded to CUSTOMER — a client can
   * never register itself as staff, regardless of what it sends in the body.
   */
  async register(dto: RegisterDto): Promise<AuthResult> {
    const user = await this.usersService.create({
      fullName: dto.fullName,
      phone: dto.phone,
      password: dto.password,
      email: dto.email,
      preferredLanguage: dto.preferredLanguage,
      role: Role.CUSTOMER,
    });

    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByPhone(dto.phone, { withSecrets: true });

    // Always run a comparison, even when the account does not exist, so response
    // timing does not reveal which phone numbers are registered.
    const passwordMatches = await this.passwordService.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Incorrect phone number or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated. Please contact support.');
    }

    await this.usersService.recordLogin(user._id.toString());

    return this.buildAuthResult(user);
  }

  /**
   * Refresh-token rotation: every refresh issues a new pair and invalidates the
   * old one. If a token that is valid but no longer current is presented, the
   * session is treated as compromised and revoked entirely.
   */
  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.jwtConfig.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }

    const user = await this.usersService.findByIdWithRefreshToken(payload.sub);

    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }

    const isCurrentToken = await this.passwordService.compare(refreshToken, user.refreshTokenHash);

    if (!isCurrentToken) {
      await this.usersService.setRefreshTokenHash(user._id.toString(), null);
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }

    return this.buildAuthResult(user);
  }

  /** Revokes the stored refresh token, ending the session server-side. */
  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.usersService.findByIdOrFail(userId);
    return UsersService.toPublicUser(user);
  }

  private async buildAuthResult(user: UserDocument): Promise<AuthResult> {
    const tokens = await this.issueTokens(user);

    // Store only a hash: a database leak must not hand out usable sessions.
    const refreshTokenHash = await this.passwordService.hash(tokens.refreshToken);
    await this.usersService.setRefreshTokenHash(user._id.toString(), refreshTokenHash);

    return { user: UsersService.toPublicUser(user), ...tokens };
  }

  private async issueTokens(user: UserDocument): Promise<AuthTokens> {
    const accessPayload: AccessTokenPayload = {
      sub: user._id.toString(),
      phone: user.phone,
      role: user.role,
      storeId: user.storeId ? user.storeId.toString() : undefined,
    };

    const refreshPayload: RefreshTokenPayload = { sub: user._id.toString() };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.jwtConfig.accessSecret,
        expiresIn: this.jwtConfig.accessExpiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.jwtConfig.refreshSecret,
        expiresIn: this.jwtConfig.refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}

/**
 * A real bcrypt hash of a value nobody knows, used to keep the failed-login path
 * as expensive as the successful one (user-enumeration defence).
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5wJyvVjPQ0h6xUKlZ9nQmL0nXvKXqKq';
