import * as crypto from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { formatUserResponse } from '../../common/utils/user-mapper.util';
import { ProfileService } from '../profile/services/profile.service';
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { UsersService } from '@/modules/users/users.service';
import { PrismaService } from '@/prisma';
import {
  UsersRepository,
  UserRolesRepository,
} from '@/modules/users/repositories';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  UserResponseDto,
  MeResponseDto,
} from './dto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserWithRelations {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  password?: string | null;
  isEmailVerified: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  userProfile: {
    fullName: string | null;
    completionPct: number;
    isDraft: boolean;
  } | null;
  userRoles: Array<{ roles: { name: string } | null }>;
  roles?: string[];
}

@Injectable()
export class AuthService {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async storeRefreshToken(userId: string, token: string): Promise<void> {
    const hash = this.hashToken(token);
    const key = `rt:${userId}:${hash}`;
    const setKey = `rt:user:${userId}`;
    const pipeline = this.redisService.client.pipeline();
    pipeline.set(key, '1', 'EX', 7 * 24 * 60 * 60); // 7 days
    pipeline.sadd(setKey, hash);
    pipeline.expire(setKey, 7 * 24 * 60 * 60);
    await pipeline.exec();
  }

  async revokeRefreshToken(userId: string, token: string): Promise<void> {
    const hash = this.hashToken(token);
    const key = `rt:${userId}:${hash}`;
    const setKey = `rt:user:${userId}`;
    const pipeline = this.redisService.client.pipeline();
    pipeline.del(key);
    pipeline.srem(setKey, hash);
    await pipeline.exec();
  }

  async isRefreshTokenActive(userId: string, token: string): Promise<boolean> {
    const hash = this.hashToken(token);
    const key = `rt:${userId}:${hash}`;
    const exists = await this.redisService.client.exists(key);
    return exists === 1;
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    const setKey = `rt:user:${userId}`;
    const hashes = await this.redisService.client.smembers(setKey);
    const pipeline = this.redisService.client.pipeline();
    for (const hash of hashes) {
      pipeline.del(`rt:${userId}:${hash}`);
    }
    pipeline.del(setKey);
    await pipeline.exec();
  }
  constructor(
    @InjectPinoLogger(AuthService.name)
    private readonly logger: PinoLogger,
    private readonly usersService: UsersService,
    private readonly usersRepo: UsersRepository,
    private readonly userRolesRepo: UserRolesRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
    private readonly redisService: RedisService,
  ) {}

  // ── Register ─────────────────────────────────
  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      this.logger.warn(
        `Registration failed: email ${dto.email} already exists`,
      );
      throw new ConflictException({
        message: 'Email already registered',
        code: 'USER_EMAIL_DUPLICATE',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.usersService.createUser({
      email: dto.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    this.logger.info(`User registered successfully: ${user.email}`);
    await this.profileService.recalculate(user.id);
    const updatedUser = await this.usersService.getUserWithProfile(user.id);
    const role = updatedUser.userRoles?.[0]?.role?.name || 'user';
    const tokens = await this.generateTokens(
      updatedUser.id,
      updatedUser.email,
      role,
    );
    await this.storeRefreshToken(updatedUser.id, tokens.refreshToken);
    return tokens;
  }

  // ── Login ────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.usersRepo.findUniqueRaw({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        isEmailVerified: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user || !user.isActive) {
      this.logger.warn(
        `Failed login attempt: ${dto.email} (user not found or inactive)`,
      );
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        code: 'AUTH_INVALID_CREDENTIALS',
      });
    }

    if (!user.password) {
      this.logger.warn(
        `Failed login attempt: ${dto.email} (SSO-only account, no password)`,
      );
      throw new UnauthorizedException(
        'This account uses SSO login. Please sign in with your provider.',
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      this.logger.warn(`Failed login attempt: ${dto.email} (wrong password)`);
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        code: 'AUTH_INVALID_CREDENTIALS',
      });
    }

    const updatedUser = await this.prisma.users.update({
      where: { email: dto.email },
      data: { lastLoginAt: new Date() },
      include: {
        userProfile: {
          select: {
            completionPct: true,
          },
        },
        userRoles: {
          include: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const role = updatedUser.userRoles?.[0]?.role?.name || 'user';
    const tokens = await this.generateTokens(
      updatedUser.id,
      updatedUser.email,
      role,
    );
    await this.storeRefreshToken(updatedUser.id, tokens.refreshToken);

    this.logger.info(`User logged in: ${updatedUser.email}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ── Refresh Token ────────────────────────────
  async refreshToken(dto: RefreshTokenDto | string) {
    const token = typeof dto === 'string' ? dto : dto.refreshToken;
    if (!token) {
      throw new UnauthorizedException({
        message: 'Refresh token is required',
        code: 'AUTH_REFRESH_TOKEN_MISSING',
      });
    }

    const isBlacklisted = await this.redisService.client.get(`bl_${token}`);
    if (isBlacklisted) {
      throw new UnauthorizedException({
        message: 'Refresh token revoked',
        code: 'AUTH_REFRESH_TOKEN_REVOKED',
      });
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException({
        message: 'Refresh token invalid or expired',
        code: 'AUTH_REFRESH_TOKEN_INVALID',
      });
    }

    const isActive = await this.isRefreshTokenActive(payload.sub, token);
    if (!isActive) {
      throw new UnauthorizedException({
        message: 'Refresh token revoked',
        code: 'AUTH_REFRESH_TOKEN_REVOKED',
      });
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const role = await this.userRolesRepo.getCurrentRoleName(user.id);
    const tokens = await this.generateTokens(user.id, user.email, role);

    await this.revokeRefreshToken(user.id, token);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // Alias for backward compatibility
  async refresh(token: string) {
    return this.refreshToken(token);
  }

  // ── Validate JWT payload (used by guard) ──────
  // eslint-disable-next-line @typescript-eslint/require-await
  async validateUser(payload: JwtPayload) {
    // Stateless validation: assume user is active and has the role in the payload
    // This avoids 2 DB queries on every authenticated request.
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      isActive: true,
    };
  }

  // ── Get Profile (GET /auth/me) ────────────────
  async getProfile(userId: string): Promise<MeResponseDto> {
    const user = await this.usersService.getUserWithProfile(userId);
    return formatUserResponse(user);
  }

  async getMe(userId: string): Promise<MeResponseDto> {
    return this.getProfile(userId);
  }

  // ── Helpers ──────────────────────────────────

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        expiresIn: this.config.get<string>(
          'security.JWT_ACCESS_EXPIRES',
          '15m',
        ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
      this.jwt.signAsync(payload, {
        expiresIn: this.config.get<string>(
          'security.JWT_REFRESH_EXPIRES',
          '7d',
        ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
