import { getLoggerToken } from 'nestjs-pino';
import { UserRolesRepository } from '@/modules/users/repositories/user-roles.repository';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@/modules/users/users.service';
import { PrismaService } from '@/prisma';
import { UsersRepository } from '@/modules/users/repositories';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { ProfileService } from '../profile/services/profile.service';
import { RedisService } from '../../redis/redis.service';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let prisma: any;
  let usersRepo: any;
  let userRolesRepo: any;

  beforeEach(async () => {
    usersRepo = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findUniqueRaw: jest.fn(),
    };
    userRolesRepo = { getCurrentRoleName: jest.fn() };
    prisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      users: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      userRoles: { create: jest.fn() },
      userProfiles: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            signAsync: jest.fn(),
            verify: jest.fn(),
            decode: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockReturnValue(
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
              ),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            updateLastLogin: jest.fn(),
            findById: jest.fn(),
            createUser: jest.fn(),
            getUserWithProfile: jest.fn(),
          },
        },
        { provide: UsersRepository, useValue: usersRepo },
        { provide: UserRolesRepository, useValue: userRolesRepo },
        { provide: PrismaService, useValue: prisma },
        {
          provide: ProfileService,
          useValue: {
            recalculateProfileProgress: jest.fn(),
            recalculateProfileStatus: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            client: {
              get: jest.fn(),
              exists: jest.fn().mockResolvedValue(1),
              pipeline: jest.fn().mockReturnValue({
                set: jest.fn(),
                sadd: jest.fn(),
                expire: jest.fn(),
                exec: jest.fn(),
                del: jest.fn(),
                srem: jest.fn(),
              }),
              smembers: jest.fn(),
            },
          },
        },
        {
          provide: getLoggerToken(AuthService.name),
          useValue: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    prisma = module.get(PrismaService);
    usersRepo = module.get(UsersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should throw Unauthorized if user not found', async () => {
      usersRepo.findUniqueRaw.mockResolvedValue(null);
      await expect(
        service.login({ email: 'a@a.com', password: '123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw Unauthorized if password invalid', async () => {
      usersRepo.findUniqueRaw.mockResolvedValue({
        id: '1',
        password: 'hash',
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.login({ email: 'a@a.com', password: '123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw Unauthorized if SSO-only account (no password)', async () => {
      usersRepo.findUniqueRaw.mockResolvedValue({
        id: '1',
        password: null,
        isActive: true,
      } as any);
      await expect(
        service.login({ email: 'a@a.com', password: '123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens on success', async () => {
      usersRepo.findUniqueRaw.mockResolvedValue({
        id: '1',
        password: 'hash',
        isActive: true,
        userRoles: [{ roles: { name: 'user' } }],
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.users.update.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        userRoles: [{ roles: { name: 'user' } }],
      } as any);
      jwtService.signAsync.mockResolvedValue('token');

      const result = await service.login({ email: 'a@a.com', password: '123' });
      expect(result.accessToken).toBe('token');
    });
  });

  describe('register', () => {
    it('should throw Conflict if user exists', async () => {
      usersService.findByEmail.mockResolvedValue({ id: '1' } as any);
      await expect(
        service.register({ email: 'a@a.com', password: '123' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should register successfully', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      usersService.createUser.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        isActive: true,
        userRoles: [{ roles: { name: 'user' } }],
      } as any);
      usersService.getUserWithProfile.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        isActive: true,
        userRoles: [{ roles: { name: 'user' } }],
      } as any);
      jwtService.signAsync.mockResolvedValue('token');

      const result = await service.register({
        email: 'a@a.com',
        password: '123',
      });
      expect(result.id).toBe('1');
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: '1',
        email: 'a@a.com',
        role: 'user',
      });
      usersService.findById.mockResolvedValue({
        id: '1',
        isActive: true,
      } as any);
      userRolesRepo.getCurrentRoleName.mockResolvedValue('user');
      jwtService.signAsync.mockResolvedValue('new-token');

      const result = await service.refreshToken({ refreshToken: 'old' });
      expect(result.accessToken).toBe('new-token');
    });

    it('should work using refresh alias', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: '1',
        email: 'a@a.com',
        role: 'user',
      });
      usersService.findById.mockResolvedValue({
        id: '1',
        isActive: true,
      } as any);
      userRolesRepo.getCurrentRoleName.mockResolvedValue('user');
      jwtService.signAsync.mockResolvedValue('new-token');

      const result = await service.refresh('old');
      expect(result.accessToken).toBe('new-token');
    });
  });

  describe('validateUser', () => {
    it('should return user with role', async () => {
      usersService.findById.mockResolvedValue({
        id: '1',
        isActive: true,
      } as any);
      userRolesRepo.getCurrentRoleName.mockResolvedValue('admin');

      const result = await service.validateUser({
        sub: '1',
        email: 'a@a.com',
        role: 'admin',
      });
      expect(result.role).toBe('admin');
    });

    it('should validate user statelessly (always active)', async () => {
      usersService.findById.mockResolvedValue({
        id: '1',
        isActive: false,
      } as any);
      const result = await service.validateUser({
        sub: '1',
        email: 'a@a.com',
        role: 'user',
      });
      expect(result.isActive).toBe(true);
    });
  });

  describe('getProfile / getMe', () => {
    it('should format and return profile', async () => {
      usersService.getUserWithProfile = jest.fn().mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        isActive: true,
        roles: ['user'],
      });

      const result1 = await service.getProfile('1');
      const result2 = await service.getMe('1');

      expect(result1.email).toBe('a@a.com');
      expect(result2.email).toBe('a@a.com');
    });
  });
});
