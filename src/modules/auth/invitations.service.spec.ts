// [OMA-W002-T009] InvitationsService Spec
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_pw_123'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('InvitationsService', () => {
  let service: InvitationsService;

  const mockPrisma = {
    users: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    roles: {
      findUnique: jest.fn(),
    },
    invitations: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userProfiles: {
      create: jest.fn(),
    },
    userRoles: {
      create: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'APP_BASE_URL') {
        return 'https://app.afaq.com';
      }
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('issueInvitation', () => {
    // [OMA-W002-T009] Given admin and new email, When issueInvitation is called, Then it generates SHA-256 token and returns invitation with link
    it('should issue a tokenized invitation with SHA-256 hash', async () => {
      // Arrange
      const adminId = 'admin-1';
      const dto = {
        email: 'scholar@oxford.edu',
        roleId: 2,
        expiresInDays: 14,
      };

      mockPrisma.users.findUnique.mockResolvedValue(null);
      mockPrisma.roles.findUnique.mockResolvedValue({ id: 2, name: 'scholar' });

      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      mockPrisma.invitations.create.mockResolvedValue({
        id: 'invite-1',
        email: 'scholar@oxford.edu',
        roleId: 2,
        invitedById: adminId,
        expiresAt,
      });

      // Act
      const result = await service.issueInvitation(adminId, dto);

      // Assert
      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { email: 'scholar@oxford.edu' },
      });
      expect(mockPrisma.roles.findUnique).toHaveBeenCalledWith({
        where: { id: 2 },
      });
      expect(mockPrisma.invitations.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'scholar@oxford.edu',
          roleId: 2,
          invitedById: adminId,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
      expect(result.token).toBeDefined();
      expect(result.inviteUrl).toContain(
        'https://app.afaq.com/auth/register?token=',
      );
      expect(result.email).toBe('scholar@oxford.edu');
    });

    // [OMA-W002-T009] Given email already exists, When issueInvitation is called, Then it throws ConflictException
    it('should throw ConflictException if user email already exists', async () => {
      // Arrange
      mockPrisma.users.findUnique.mockResolvedValue({ id: 'existing-user' });

      // Act & Assert
      await expect(
        service.issueInvitation('admin-1', { email: 'existing@afaq.com' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.invitations.create).not.toHaveBeenCalled();
    });

    // [OMA-W002-T009] Given invalid roleId, When issueInvitation is called, Then it throws BadRequestException
    it('should throw BadRequestException if specified roleId is invalid', async () => {
      // Arrange
      mockPrisma.users.findUnique.mockResolvedValue(null);
      mockPrisma.roles.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.issueInvitation('admin-1', {
          email: 'new@afaq.com',
          roleId: 999,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateToken', () => {
    // [OMA-W002-T009] Given valid unconsumed token, When validateToken is called, Then it returns valid status and metadata
    it('should validate valid unexpired invitation token', async () => {
      // Arrange
      const rawToken = 'abc123token';
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');
      const invitation = {
        id: 'invite-1',
        email: 'scholar@harvard.edu',
        roleId: 1,
        role: { name: 'candidate' },
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Valid in future
      };

      mockPrisma.invitations.findUnique.mockResolvedValue(invitation);

      // Act
      const result = await service.validateToken(rawToken);

      // Assert
      expect(mockPrisma.invitations.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
        include: { role: true },
      });
      expect(result).toEqual({
        valid: true,
        email: 'scholar@harvard.edu',
        roleId: 1,
        roleName: 'candidate',
        expiresAt: invitation.expiresAt,
      });
    });

    // [OMA-W002-T009] Given unknown token, When validateToken is called, Then it throws NotFoundException
    it('should throw NotFoundException if token does not exist', async () => {
      // Arrange
      mockPrisma.invitations.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.validateToken('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    // [OMA-W002-T009] Given already consumed token, When validateToken is called, Then it throws BadRequestException
    it('should throw BadRequestException if token has already been accepted', async () => {
      // Arrange
      mockPrisma.invitations.findUnique.mockResolvedValue({
        id: 'invite-1',
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 10000),
      });

      // Act & Assert
      await expect(service.validateToken('consumed-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    // [OMA-W002-T009] Given expired token, When validateToken is called, Then it throws BadRequestException
    it('should throw BadRequestException if invitation token has expired', async () => {
      // Arrange
      mockPrisma.invitations.findUnique.mockResolvedValue({
        id: 'invite-1',
        acceptedAt: null,
        expiresAt: new Date(Date.now() - 10000), // In past
      });

      // Act & Assert
      await expect(service.validateToken('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('registerWithInvite', () => {
    // [OMA-W002-T009] Given valid token and details, When registerWithInvite is called, Then it creates user, profile, roles, and marks invitation accepted
    it('should successfully register user, assign role, and consume invitation token', async () => {
      // Arrange
      const rawToken = 'valid-token';
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');
      const dto = {
        token: rawToken,
        password: 'SecurePassword123!',
        firstName: 'Jane',
        lastName: 'Doe',
      };

      const invitation = {
        id: 'invite-1',
        email: 'jane.doe@oxford.edu',
        roleId: 2,
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrisma.invitations.findUnique.mockResolvedValue(invitation);
      mockPrisma.users.findUnique.mockResolvedValue(null);

      const createdUser = {
        id: 'user-new-1',
        email: invitation.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isEmailVerified: true,
      };
      mockPrisma.users.create.mockResolvedValue(createdUser);

      // Act
      const result = await service.registerWithInvite(dto);

      // Assert
      expect(mockPrisma.invitations.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
      });
      expect(mockPrisma.users.create).toHaveBeenCalledWith({
        data: {
          email: invitation.email,
          password: 'hashed_pw_123',
          firstName: dto.firstName,
          lastName: dto.lastName,
          isEmailVerified: true,
        },
      });
      expect(mockPrisma.userProfiles.create).toHaveBeenCalledWith({
        data: {
          userId: createdUser.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });
      expect(mockPrisma.userRoles.create).toHaveBeenCalledWith({
        data: {
          userId: createdUser.id,
          roleId: invitation.roleId,
        },
      });
      expect(mockPrisma.invitations.update).toHaveBeenCalledWith({
        where: { id: invitation.id },
        data: { acceptedAt: expect.any(Date) },
      });
      expect(result).toEqual({
        message: 'Account successfully registered and invitation accepted',
        userId: createdUser.id,
        email: createdUser.email,
      });
    });

    // [OMA-W002-T009] Given email already registered during invite consumption, When registerWithInvite is called, Then it throws ConflictException
    it('should throw ConflictException if user email became registered before consuming invite', async () => {
      // Arrange
      const invitation = {
        id: 'invite-1',
        email: 'taken@afaq.com',
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrisma.invitations.findUnique.mockResolvedValue(invitation);
      mockPrisma.users.findUnique.mockResolvedValue({ id: 'existing-user' });

      // Act & Assert
      await expect(
        service.registerWithInvite({
          token: 'some-token',
          password: 'pw',
          firstName: 'A',
          lastName: 'B',
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.users.create).not.toHaveBeenCalled();
    });

    // [OMA-W002-T009] Given expired token, When registerWithInvite is called, Then it throws BadRequestException
    it('should throw BadRequestException if token expired during registration', async () => {
      // Arrange
      mockPrisma.invitations.findUnique.mockResolvedValue({
        id: 'invite-1',
        acceptedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      // Act & Assert
      await expect(
        service.registerWithInvite({
          token: 'expired-token',
          password: 'pw',
          firstName: 'A',
          lastName: 'B',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
