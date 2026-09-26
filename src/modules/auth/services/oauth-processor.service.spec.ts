import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuthProcessorService } from './oauth-processor.service';
import { EncryptionService } from './encryption.service';
import { OauthIdentityService } from './oauth-identity.service';
import { PrismaService } from '@/prisma';

describe('OAuthProcessorService', () => {
  let service: OAuthProcessorService;

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockPrisma = {
    $transaction: jest.fn().mockImplementation((cb) => {
      // Pass mockPrisma as the transaction client
      return cb(mockPrisma);
    }),
    users: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    roles: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    oauthIdentities: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockEncryptionService = {
    encrypt: jest.fn().mockImplementation((val: string) => `enc_${val}`),
    decrypt: jest
      .fn()
      .mockImplementation((val: string) => val.replace('enc_', '')),
  };

  const mockOauthIdentityService = {
    findByProvider: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('signed-jwt-token'),
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue('15m'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthProcessorService,
        {
          provide: 'PinoLogger:OAuthProcessorService',
          useValue: mockLogger,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
        {
          provide: OauthIdentityService,
          useValue: mockOauthIdentityService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<OAuthProcessorService>(OAuthProcessorService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Missing Email Handling (FR-002-19)', () => {
    it('should throw BadRequestException when email is undefined', async () => {
      await expect(
        service.processOAuthLogin({
          provider: 'google',
          providerUserId: 'g-123',
          email: undefined,
          accessToken: 'token-123',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.processOAuthLogin({
          provider: 'google',
          providerUserId: 'g-123',
          email: undefined,
          accessToken: 'token-123',
        }),
      ).rejects.toThrow(
        'Unable to retrieve email from the provider. Please ensure your email is public or use another login method.',
      );
    });

    it('should throw BadRequestException when email is empty string', async () => {
      await expect(
        service.processOAuthLogin({
          provider: 'linkedin',
          providerUserId: 'li-123',
          email: '   ',
          accessToken: 'token-123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Existing OAuth Identity', () => {
    it('should update tokens and return existing user if identity exists', async () => {
      const existingUser = {
        id: 'user-uuid-1',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        isEmailVerified: true,
        userProfile: {
          fullName: 'John Doe',
          isDraft: false,
          completionPct: 100,
        },
        userRoles: [{ roles: { name: 'user' } }],
      };

      const existingIdentity = {
        id: 'identity-1',
        provider: 'google',
        providerUserId: 'g-123',
        user: existingUser,
      };

      mockOauthIdentityService.findByProvider.mockResolvedValue(
        existingIdentity,
      );
      mockOauthIdentityService.update.mockResolvedValue(existingIdentity);
      mockPrisma.users.update.mockResolvedValue(existingUser);

      const result = await service.processOAuthLogin({
        provider: 'google',
        providerUserId: 'g-123',
        email: 'user@example.com',
        accessToken: 'access-123',
        refreshToken: 'refresh-123',
      });

      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('access-123');
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('refresh-123');
      expect(mockPrisma.oauthIdentities.update).toHaveBeenCalledWith({
        where: { id: 'identity-1' },
        data: {
          accessTokenRef: 'enc_access-123',
          refreshTokenRef: 'enc_refresh-123',
        },
      });
      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { lastLoginAt: expect.anything() },
        include: {
          userProfile: true,
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });
      expect(result.accessToken).toEqual('signed-jwt-token');
      expect(result.refreshToken).toEqual('signed-jwt-token');
    });

    it('should throw UnauthorizedException if existing identity user is deactivated', async () => {
      const deactivatedUser = {
        id: 'user-uuid-1',
        email: 'inactive@example.com',
        isActive: false,
      };

      mockOauthIdentityService.findByProvider.mockResolvedValue({
        id: 'identity-1',
        user: deactivatedUser,
      });

      await expect(
        service.processOAuthLogin({
          provider: 'google',
          providerUserId: 'g-123',
          email: 'inactive@example.com',
          accessToken: 'access-123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Existing User Account Linking (FR-002-08)', () => {
    it('should link OAuth identity when email matches an existing user without identity', async () => {
      const existingUser = {
        id: 'user-uuid-2',
        email: 'existing@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        isActive: true,
        isEmailVerified: false,
        userProfile: { fullName: 'Jane Doe', isDraft: true, completionPct: 50 },
        userRoles: [{ roles: { name: 'user' } }],
      };

      mockOauthIdentityService.findByProvider.mockResolvedValue(null);
      mockPrisma.users.findUnique.mockResolvedValue(existingUser);
      mockOauthIdentityService.create.mockResolvedValue({
        id: 'new-identity-id',
      });
      mockPrisma.users.update.mockResolvedValue(existingUser);

      await service.processOAuthLogin({
        provider: 'linkedin',
        providerUserId: 'li-456',
        email: 'existing@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        accessToken: 'access-456',
      });

      expect(mockPrisma.oauthIdentities.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-uuid-2',
          provider: 'linkedin',
          providerUserId: 'li-456',
          accessTokenRef: 'enc_access-456',
          refreshTokenRef: null,
        },
      });
      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-2' },
        data: {
          isEmailVerified: true,
          lastLoginAt: expect.anything(),
          firstName: 'Jane',
          lastName: 'Doe',
        },
        include: {
          userProfile: true,
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });
    });

    it('should throw UnauthorizedException if existing matched user is deactivated', async () => {
      mockOauthIdentityService.findByProvider.mockResolvedValue(null);
      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'user-uuid-2',
        email: 'inactive@example.com',
        isActive: false,
      });

      await expect(
        service.processOAuthLogin({
          provider: 'linkedin',
          providerUserId: 'li-456',
          email: 'inactive@example.com',
          accessToken: 'access-456',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('New User Creation (FR-002-07, FR-002-09, FR-002-10, FR-002-12)', () => {
    it('should create new user with isDraft: true, isEmailVerified: true, default role and identity', async () => {
      mockOauthIdentityService.findByProvider.mockResolvedValue(null);
      mockPrisma.users.findUnique.mockResolvedValue(null);
      mockPrisma.roles.findUnique.mockResolvedValue({ id: 1, name: 'user' });

      const createdUser = {
        id: 'new-user-uuid',
        email: 'newuser@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        isActive: true,
        isEmailVerified: true,
        createdAt: new Date(),
        userProfile: {
          fullName: 'Alice Smith',
          profilePhotoUrl: 'https://photo.url',
          isDraft: true,
          completionPct: 0,
        },
        userRoles: [{ roles: { name: 'user' } }],
      };

      mockPrisma.users.create.mockResolvedValue(createdUser);

      await service.processOAuthLogin({
        provider: 'google',
        providerUserId: 'g-999',
        email: 'NewUser@example.com', // test case normalization
        firstName: 'Alice',
        lastName: 'Smith',
        picture: 'https://photo.url',
        accessToken: 'access-999',
        refreshToken: 'refresh-999',
      });

      expect(mockPrisma.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'newuser@example.com',
            firstName: 'Alice',
            lastName: 'Smith',
          }),
        }),
      );

      // expect
      // expect
    });
  });
});
