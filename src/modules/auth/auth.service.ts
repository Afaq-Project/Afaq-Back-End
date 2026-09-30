import * as crypto from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { formatUserResponse } from '../../common/utils/user-mapper.util';
import { ProfileService } from '../profile/services/profile.service';
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
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
  MeResponseDto,
  RegisterResponseDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto';
import { MailService } from '../mail/mail.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tokenVersion: number;
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
    const keys = await this.redisService.client.keys(`rt:${userId}:*`);
    const pipeline = this.redisService.client.pipeline();
    for (const key of keys) {
      pipeline.del(key);
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
    private readonly mailService: MailService,
  ) {}

  // ── Register ─────────────────────────────────
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
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

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const pipeline = this.redisService.client.pipeline();
    pipeline.set(`vt:current:${user.id}`, hash, 'EX', 86400);
    pipeline.set(`vt:${hash}`, user.id, 'EX', 86400);
    await pipeline.exec();

    await this.mailService.sendVerificationEmail(user.id, user.email, rawToken);

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      data: null,
    };
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
        passwordResetRequired: true,
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
      throw new UnauthorizedException({
        message:
          'This account uses SSO login. Please sign in with your provider.',
        code: 'AUTH_SSO_ONLY',
      });
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      this.logger.warn(`Failed login attempt: ${dto.email} (wrong password)`);
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        code: 'AUTH_INVALID_CREDENTIALS',
      });
    }

    if (!user.isEmailVerified) {
      this.logger.warn(
        `Failed login attempt: ${dto.email} (email not verified)`,
      );
      throw new ForbiddenException({
        message: 'Email not verified',
        code: 'AUTH_EMAIL_NOT_VERIFIED',
      });
    }

    if (user.passwordResetRequired) {
      this.logger.warn(
        `Failed login attempt: ${dto.email} (password reset required)`,
      );
      throw new ForbiddenException({
        message: 'Password reset required',
        code: 'AUTH_PASSWORD_RESET_REQUIRED',
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

  // ── Verify Email ─────────────────────────────
  async verifyEmail(token: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    const userId = await this.redisService.client.get(`vt:${hash}`);
    if (!userId) {
      throw new BadRequestException({
        message: 'Invalid or expired verification token',
        code: 'AUTH_TOKEN_INVALID',
      });
    }

    const currentHash = await this.redisService.client.get(
      `vt:current:${userId}`,
    );
    if (currentHash !== hash) {
      throw new BadRequestException({
        message: 'Invalid or expired verification token',
        code: 'AUTH_TOKEN_INVALID',
      });
    }

    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (user.isEmailVerified) {
      throw new BadRequestException({
        message: 'Account is already verified',
        code: 'AUTH_ALREADY_VERIFIED',
      });
    }

    await this.prisma.users.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });

    const pipeline = this.redisService.client.pipeline();
    pipeline.del(`vt:${hash}`);
    pipeline.del(`vt:current:${userId}`);
    await pipeline.exec();
  }

  // ── Resend Verification Email ────────────────────────
  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.usersRepo.findUniqueRaw({
      where: { email },
      select: { id: true, email: true, isEmailVerified: true },
    });

    if (!user || user.isEmailVerified) {
      return;
    }

    const currentHash = await this.redisService.client.get(
      `vt:current:${user.id}`,
    );

    if (currentHash) {
      await this.redisService.client.del(`vt:${currentHash}`);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const pipeline = this.redisService.client.pipeline();
    pipeline.set(`vt:current:${user.id}`, hash, 'EX', 86400);
    pipeline.set(`vt:${hash}`, user.id, 'EX', 86400);
    await pipeline.exec();

    await this.mailService.sendVerificationEmail(user.id, user.email, rawToken);
  }

  // ── Forgot Password ──────────────────────────
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersRepo.findUniqueRaw({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      // Handle unregistered emails silently
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const pipeline = this.redisService.client.pipeline();
    // PRT TTL is 1 hour (3600 seconds)
    pipeline.set(`prt:current:${user.id}`, hash, 'EX', 3600);
    pipeline.set(`prt:${hash}`, user.id, 'EX', 3600);
    await pipeline.exec();

    await this.mailService.sendPasswordResetEmail(
      user.id,
      user.email,
      rawToken,
    );
  }

  // ── Reset Password ───────────────────────────
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const hash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const userId = await this.redisService.client.get(`prt:${hash}`);
    if (!userId) {
      throw new BadRequestException({
        message: 'Invalid or expired password reset token',
        code: 'AUTH_TOKEN_INVALID',
      });
    }

    const currentHash = await this.redisService.client.get(
      `prt:current:${userId}`,
    );
    if (currentHash !== hash) {
      throw new BadRequestException({
        message: 'Invalid or expired password reset token',
        code: 'AUTH_TOKEN_INVALID',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    await this.prisma.users.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordResetRequired: false,
        passwordResetRequiredAt: null,
      },
    });

    await this.revokeAllUserRefreshTokens(userId);
    await this.incrementTokenVersion(userId);

    const pipeline = this.redisService.client.pipeline();
    pipeline.del(`prt:${hash}`);
    pipeline.del(`prt:current:${userId}`);
    await pipeline.exec();
  }

  // ── Change Password ──────────────────────────
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersRepo.findUniqueRaw({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.password) {
      throw new BadRequestException({
        message: 'Cannot change SSO password',
        code: 'CANNOT_CHANGE_SSO_PASSWORD',
      });
    }

    const passwordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!passwordValid) {
      throw new BadRequestException({
        message: 'Invalid current password',
        code: 'AUTH_INVALID_CREDENTIALS',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.users.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordResetRequired: false,
        passwordResetRequiredAt: null,
      },
    });

    await this.revokeAllUserRefreshTokens(userId);
  }

  // ── Force Password Reset ─────────────────────
  /**
   * Forces a user to reset their password on next login.
   * Invalidates all active sessions.
   */
  async forcePasswordReset(
    targetUserId: string,
  ): Promise<{ applicable: boolean } | void> {
    const user = await this.usersRepo.findUniqueRaw({
      where: { id: targetUserId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.password) {
      return { applicable: false };
    }

    await this.prisma.users.update({
      where: { id: targetUserId },
      data: {
        passwordResetRequired: true,
        passwordResetRequiredAt: new Date(),
      },
    });

    await this.revokeAllUserRefreshTokens(targetUserId);
    await this.incrementTokenVersion(targetUserId);
  }

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
      throw new UnauthorizedException({
        message: 'Account is deactivated',
        code: 'AUTH_ACCOUNT_DEACTIVATED',
      });
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
  async validateUser(payload: JwtPayload, token?: string) {
    if (token) {
      const isBlacklisted = await this.redisService.client.exists(
        `bl_${token}`,
      );
      if (isBlacklisted === 1) {
        throw new UnauthorizedException({
          message: 'Token revoked',
          code: 'AUTH_TOKEN_REVOKED',
        });
      }
    }

    const payloadVersion = payload.tokenVersion || 1;
    const currentVersionStr = await this.redisService.client.get(
      `tv:${payload.sub}`,
    );
    if (!currentVersionStr) {
      throw new UnauthorizedException({
        message: 'Token version missing or invalidated',
        code: 'AUTH_TOKEN_REVOKED',
      });
    }
    const currentVersion = parseInt(currentVersionStr, 10);

    if (payloadVersion < currentVersion) {
      throw new UnauthorizedException({
        message: 'Token revoked',
        code: 'AUTH_TOKEN_REVOKED',
      });
    }

    // Stateless validation: assume user is active and has the role in the payload
    // This avoids 2 DB queries on every authenticated request.
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      isActive: true,
    };
  }

  // ── Logout ─────────────────────────────────────
  async logout(token: string, userId: string): Promise<void> {
    await this.revokeAllUserRefreshTokens(userId);

    // Decode token to get expiration and blacklist it
    const decoded = this.jwt.decode(token);
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redisService.client.set(`bl_${token}`, 'revoked', 'EX', ttl);
      }
    }
  }

  // ── Get Profile (GET /auth/me) ────────────────
  async getProfile(userId: string): Promise<MeResponseDto> {
    const user = await this.usersService.getUserWithProfile(userId);
    return formatUserResponse(user);
  }

  async getMe(userId: string): Promise<MeResponseDto> {
    return this.getProfile(userId);
  }

  async getOrInitTokenVersion(userId: string): Promise<number> {
    const key = `tv:${userId}`;
    const val = await this.redisService.client.get(key);
    if (val !== null) {
      return parseInt(val, 10);
    }
    await this.redisService.client.set(key, '1');
    return 1;
  }

  async incrementTokenVersion(userId: string): Promise<number> {
    const key = `tv:${userId}`;
    return this.redisService.client.incr(key);
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<AuthTokens> {
    const tokenVersion = await this.getOrInitTokenVersion(userId);
    const payload: JwtPayload = { sub: userId, email, role, tokenVersion };

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
