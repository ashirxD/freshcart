import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppConfig } from 'src/common/config/configuration';
import { Role } from 'src/common/enums';
import { PasswordService } from 'src/common/security';
import { UserDocument } from 'src/modules/users/schemas';
import { UsersService } from 'src/modules/users/users.service';
import { AuthService } from './auth.service';

type MockedUsersService = jest.Mocked<
  Pick<
    UsersService,
    | 'create'
    | 'findByPhone'
    | 'findByIdWithRefreshToken'
    | 'findByIdOrFail'
    | 'setRefreshTokenHash'
    | 'recordLogin'
  >
>;

function buildUser(overrides: Partial<UserDocument> = {}): UserDocument {
  return {
    _id: { toString: () => 'user-1' },
    fullName: 'Ayesha Khan',
    phone: '+923001234567',
    role: Role.CUSTOMER,
    isActive: true,
    storeId: null,
    preferredLanguage: 'en',
    passwordHash: 'stored-hash',
    refreshTokenHash: 'stored-refresh-hash',
    phoneVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as unknown as UserDocument;
}

describe('AuthService', () => {
  let usersService: MockedUsersService;
  let passwordService: jest.Mocked<Pick<PasswordService, 'hash' | 'compare'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;
  let authService: AuthService;

  beforeEach(() => {
    usersService = {
      create: jest.fn(),
      findByPhone: jest.fn(),
      findByIdWithRefreshToken: jest.fn(),
      findByIdOrFail: jest.fn(),
      setRefreshTokenHash: jest.fn().mockResolvedValue(undefined),
      recordLogin: jest.fn().mockResolvedValue(undefined),
    };

    passwordService = {
      hash: jest.fn().mockResolvedValue('new-hash'),
      compare: jest.fn().mockResolvedValue(true),
    };

    jwtService = {
      signAsync: jest
        .fn()
        .mockImplementation((_payload, options: { secret: string }) =>
          Promise.resolve(options.secret === 'refresh-secret' ? 'refresh-token' : 'access-token'),
        ),
      verifyAsync: jest.fn(),
    };

    const configService = {
      get: jest.fn().mockReturnValue({
        accessSecret: 'access-secret',
        accessExpiresIn: '15m',
        refreshSecret: 'refresh-secret',
        refreshExpiresIn: '7d',
      }),
    } as unknown as ConfigService<AppConfig, true>;

    authService = new AuthService(
      usersService as unknown as UsersService,
      passwordService as unknown as PasswordService,
      jwtService as unknown as JwtService,
      configService,
    );
  });

  describe('register', () => {
    it('forces the CUSTOMER role so a client cannot self-promote', async () => {
      usersService.create.mockResolvedValue(buildUser());

      await authService.register({
        fullName: 'Ayesha Khan',
        phone: '+923001234567',
        password: 'Secret123',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.CUSTOMER }),
      );
    });

    it('stores only a hash of the refresh token', async () => {
      usersService.create.mockResolvedValue(buildUser());

      const result = await authService.register({
        fullName: 'Ayesha Khan',
        phone: '+923001234567',
        password: 'Secret123',
      });

      expect(passwordService.hash).toHaveBeenCalledWith('refresh-token');
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith('user-1', 'new-hash');
      expect(result.accessToken).toBe('access-token');
    });
  });

  describe('login', () => {
    it('returns a session for valid credentials', async () => {
      usersService.findByPhone.mockResolvedValue(buildUser());

      const result = await authService.login({ phone: '+923001234567', password: 'Secret123' });

      expect(result.user.phone).toBe('+923001234567');
      expect(usersService.recordLogin).toHaveBeenCalledWith('user-1');
    });

    it('rejects an unknown phone number without revealing that it is unknown', async () => {
      usersService.findByPhone.mockResolvedValue(null);
      passwordService.compare.mockResolvedValue(false);

      await expect(
        authService.login({ phone: '+923009999999', password: 'Secret123' }),
      ).rejects.toThrow(UnauthorizedException);

      // The comparison still runs, so the failure path costs the same as success.
      expect(passwordService.compare).toHaveBeenCalled();
    });

    it('rejects a wrong password', async () => {
      usersService.findByPhone.mockResolvedValue(buildUser());
      passwordService.compare.mockResolvedValue(false);

      await expect(
        authService.login({ phone: '+923001234567', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refuses a deactivated account', async () => {
      usersService.findByPhone.mockResolvedValue(buildUser({ isActive: false }));

      await expect(
        authService.login({ phone: '+923001234567', password: 'Secret123' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refresh', () => {
    it('rotates the token and issues a new session', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      usersService.findByIdWithRefreshToken.mockResolvedValue(buildUser());

      const result = await authService.refresh('refresh-token');

      expect(result.accessToken).toBe('access-token');
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith('user-1', 'new-hash');
    });

    it('rejects a token that fails signature verification', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

      await expect(authService.refresh('tampered')).rejects.toThrow(UnauthorizedException);
    });

    it('revokes the session when a superseded token is replayed', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      usersService.findByIdWithRefreshToken.mockResolvedValue(buildUser());
      passwordService.compare.mockResolvedValue(false);

      await expect(authService.refresh('old-token')).rejects.toThrow(UnauthorizedException);
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith('user-1', null);
    });

    it('rejects a refresh for a deactivated account', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      usersService.findByIdWithRefreshToken.mockResolvedValue(buildUser({ isActive: false }));

      await expect(authService.refresh('refresh-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('clears the stored refresh token so the session cannot be resumed', async () => {
      await authService.logout('user-1');
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith('user-1', null);
    });
  });
});
