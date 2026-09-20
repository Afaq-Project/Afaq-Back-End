import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../redis/redis.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthProcessorService } from './services/oauth-processor.service';

import { AuthGuard } from '@common/guards';
import { OAuthGuard } from './guards/oauth.guard';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    getMe: jest.fn(),
  };

  const mockOAuthProcessorService = {
    processOAuthLogin: jest.fn(),
  };

  const mockConfigService = {
    get: jest
      .fn()
      .mockReturnValue(
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: OAuthProcessorService,
          useValue: mockOAuthProcessorService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: JwtService,
          useValue: {},
        },
        {
          provide: RedisService,
          useValue: {},
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      };
      const expectedResult = {
        id: 'user-1',
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isEmailVerified: false,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        userProfile: null,
        roles: ['user'],
      };
      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(dto);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('login', () => {
    it('should call authService.login and set cookies', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'Password123!',
      };
      const expectedResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-1',
          email: dto.email,
          firstName: 'John',
          lastName: 'Doe',
          isEmailVerified: true,
          isActive: true,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          userProfile: null,
          roles: ['user'],
        },
      };
      mockAuthService.login.mockResolvedValue(expectedResult);

      const mockRes = { cookie: jest.fn() };
      const result = await controller.login(dto, mockRes as never);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('oauthCallback', () => {
    it('should throw UnauthorizedException when user is not authenticated', async () => {
      const mockReq = {
        params: { provider: 'google' },
        user: null,
      };
      const mockRes = { cookie: jest.fn() };

      await expect(
        controller.oauthCallback('google', mockReq as never, mockRes as never),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        controller.oauthCallback('google', mockReq as never, mockRes as never),
      ).rejects.toThrow('Authentication failed');
    });

    it('should call processOAuthLogin, set cookies and return auth result', async () => {
      const mockUser = {
        profile: {
          id: '123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          picture: 'https://example.com/photo.jpg',
          provider: 'google',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      const mockResult = {
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        user: {
          id: 'user-uuid-1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          isEmailVerified: true,
          isActive: true,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          userProfile: {
            fullName: 'Test User',
            isDraft: true,
            completionPct: 0,
          },
          roles: ['user'],
        },
      };

      mockOAuthProcessorService.processOAuthLogin.mockResolvedValue(mockResult);

      const mockReq = {
        params: { provider: 'google' },
        user: mockUser,
      };

      const mockRes = {
        cookie: jest.fn(),
      };

      const result = await controller.oauthCallback(
        'google',
        mockReq as never,
        mockRes as never,
      );

      expect(mockOAuthProcessorService.processOAuthLogin).toHaveBeenCalledWith({
        provider: 'google',
        providerUserId: '123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        picture: 'https://example.com/photo.jpg',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockResult);
    });
  });
});
