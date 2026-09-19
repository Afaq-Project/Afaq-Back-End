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
import { LoginDto, RegisterDto, RefreshTokenDto, UserResponseDto } from './dto';

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
    await this.profileService.recalculateProfileProgress(user.id);
    const updatedUser = await this.usersService.getUserWithProfile(user.id);
    return formatUserResponse(updatedUser) as unknown as UserResponseDto;
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
            fullName: true,
            completionPct: true,
            isDraft: true,
          },
        },
        userRoles: {
          include: {
            roles: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const role = updatedUser.userRoles?.[0]?.roles?.name || 'user';
    const tokens = await this.generateTokens(
      updatedUser.id,
      updatedUser.email,
      role,
    );

    const userOutput: UserResponseDto = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      isEmailVerified: updatedUser.isEmailVerified,
      isActive: updatedUser.isActive,
      lastLoginAt: updatedUser.lastLoginAt,
      createdAt: updatedUser.createdAt,
      userProfile: updatedUser.userProfile,
      roles: [role],
    };

    this.logger.info(`User logged in: ${updatedUser.email}`);

    return {
      ...tokens,
      user: userOutput,
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
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }

      const role = await this.userRolesRepo.getCurrentRoleName(user.id);

      const tokens = await this.generateTokens(user.id, user.email, role);

      const ttl: number = (payload as { exp?: number }).exp
        ? Number((payload as { exp?: number }).exp) -
          Math.floor(Date.now() / 1000)
        : 0;
      if (ttl > 0) {
        await this.redisService.client.set(`bl_${token}`, 'revoked', 'EX', ttl);
      }

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException({
        message: 'Invalid or expired refresh token',
        code: 'AUTH_REFRESH_TOKEN_INVALID',
      });
    }
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
  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.getUserWithProfile(userId);
    return formatUserResponse(user) as unknown as UserResponseDto;
  }

  async getMe(userId: string): Promise<UserResponseDto> {
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
