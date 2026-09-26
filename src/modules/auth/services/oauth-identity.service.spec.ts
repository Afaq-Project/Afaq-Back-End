import { Test, TestingModule } from '@nestjs/testing';
import { OauthIdentityService } from './oauth-identity.service';
import { PrismaService } from '@/prisma';

describe('OauthIdentityService', () => {
  let service: OauthIdentityService;

  const mockPrisma = {
    oauthIdentities: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OauthIdentityService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<OauthIdentityService>(OauthIdentityService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByProvider', () => {
    it('should find identity by provider and providerUserId', async () => {
      const mockResult = {
        id: 'identity-1',
        provider: 'google',
        providerUserId: 'google-123',
        userId: 'user-1',
        user: { id: 'user-1', email: 'test@example.com' },
      };

      mockPrisma.oauthIdentities.findUnique.mockResolvedValue(mockResult);

      const result = await service.findByProvider('google', 'google-123');

      expect(mockPrisma.oauthIdentities.findUnique).toHaveBeenCalledWith({
        where: {
          provider_providerUserId: {
            provider: 'google',
            providerUserId: 'google-123',
          },
        },
        include: {
          user: {
            include: {
              userProfile: true,
              userRoles: {
                include: {
                  role: true,
                },
              },
            },
          },
        },
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('create', () => {
    it('should create an OAuth identity record', async () => {
      const createDto = {
        userId: 'user-1',
        provider: 'google',
        providerUserId: 'google-123',
        accessTokenRef: 'enc-access-token',
        refreshTokenRef: 'enc-refresh-token',
      };

      const mockCreated = { id: 'identity-1', ...createDto };
      mockPrisma.oauthIdentities.create.mockResolvedValue(mockCreated);

      const result = await service.create(createDto);

      expect(mockPrisma.oauthIdentities.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          provider: 'google',
          providerUserId: 'google-123',
          accessTokenRef: 'enc-access-token',
          refreshTokenRef: 'enc-refresh-token',
        },
      });
      expect(result).toEqual(mockCreated);
    });
  });

  describe('update', () => {
    it('should update OAuth identity tokens', async () => {
      const updateDto = {
        accessTokenRef: 'new-enc-access',
        refreshTokenRef: 'new-enc-refresh',
      };

      const mockUpdated = { id: 'identity-1', ...updateDto };
      mockPrisma.oauthIdentities.update.mockResolvedValue(mockUpdated);

      const result = await service.update('identity-1', updateDto);

      expect(mockPrisma.oauthIdentities.update).toHaveBeenCalledWith({
        where: { id: 'identity-1' },
        data: {
          accessTokenRef: 'new-enc-access',
          refreshTokenRef: 'new-enc-refresh',
        },
      });
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('findByUser', () => {
    it('should return all identities for a user', async () => {
      const mockList = [
        { id: 'id-1', provider: 'google', userId: 'user-1' },
        { id: 'id-2', provider: 'linkedin', userId: 'user-1' },
      ];

      mockPrisma.oauthIdentities.findMany.mockResolvedValue(mockList);

      const result = await service.findByUser('user-1');

      expect(mockPrisma.oauthIdentities.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toEqual(mockList);
    });
  });
});
