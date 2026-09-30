import { ExtractJwt } from 'passport-jwt';
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService, AuthTokens } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
  MeResponseDto,
  RegisterResponseDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  ResendVerificationDto,
} from './dto';
import { Public, CurrentUser } from '@common/decorators';
import { AuthGuard } from '@common/guards';
import { ErrorResponse } from '@common/dto';
import { OAuthGuard, CsrfOriginGuard, EmailRateLimitGuard } from './guards';
import { OAuthProcessorService } from './services/oauth-processor.service';

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';

interface PassportOAuthUser {
  profile: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    picture?: string;
    provider: string;
  };
  refreshToken: string | null;
  accessToken: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthProcessorService: OAuthProcessorService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  private setTokenCookies(res: Response, tokens: AuthTokens) {
    const isSecure = this.config.get<boolean>('security.COOKIE_SECURE', false);
    const domain = this.config.get<string>('security.COOKIE_DOMAIN');

    const baseOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax' as const,
      ...(domain ? { domain } : {}),
    };

    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...baseOptions,
      path: '/',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...baseOptions,
      path: '/api/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearTokenCookies(res: Response) {
    const domain = this.config.get<string>('security.COOKIE_DOMAIN');
    const opts = { httpOnly: true, ...(domain ? { domain } : {}) };

    res.clearCookie(ACCESS_COOKIE, { ...opts, path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...opts, path: '/api/v1/auth/refresh' });
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user and create profile' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: RegisterResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or weak password',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered',
    type: ErrorResponse,
  })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired token',
    type: ErrorResponse,
  })
  async verifyEmail(
    @Query() dto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    await this.authService.verifyEmail(dto.token);
    return { message: 'Email verified successfully. You may now log in.' };
  }

  @Public()
  @UseGuards(EmailRateLimitGuard)
  @Throttle({ default: { ttl: 60000, limit: 1 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a fresh verification email' })
  @ApiResponse({
    status: 200,
    description:
      'If this email is registered and unverified, a new verification email has been sent.',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
    type: ErrorResponse,
  })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    await this.authService.resendVerificationEmail(dto.email);
    return {
      message:
        'If this email is registered and unverified, a new verification email has been sent.',
    };
  }

  @Public()
  @UseGuards(EmailRateLimitGuard)
  @Throttle({ default: { ttl: 60000, limit: 1 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({
    status: 200,
    description:
      'If this email is registered, a password reset link has been sent.',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
    type: ErrorResponse,
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return {
      message:
        'If this email is registered, a password reset link has been sent.',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a valid reset token' })
  @ApiResponse({
    status: 200,
    description:
      'Password has been reset successfully. Please log in with your new password.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid token, password mismatch, or weak password',
    type: ErrorResponse,
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto);
    return {
      message:
        'Password has been reset successfully. Please log in with your new password.',
    };
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid current password, weak new password, or SSO account',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
    type: ErrorResponse,
  })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(userId, dto);
    return {
      message: 'Password changed successfully.',
    };
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns access and refresh tokens',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
    type: ErrorResponse,
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(dto);
    this.setTokenCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return result;
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(CsrfOriginGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
    type: ErrorResponse,
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshTokenResponseDto> {
    const token =
      dto?.refreshToken ||
      (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];

    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const result = await this.authService.refreshToken(token);
    this.setTokenCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return result;
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (clear cookies)' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (token) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const decoded = this.jwtService.decode(token);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (decoded && decoded.sub) {
          await this.authService.logout(token, String(decoded.sub));
        }
      } catch (error) {
        console.error('LOGOUT ERROR:', error);
      }
    }
    this.clearTokenCookies(res);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile retrieved successfully',
    type: MeResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
    type: ErrorResponse,
  })
  getProfile(@CurrentUser('id') userId: string): Promise<MeResponseDto> {
    return this.authService.getMe(userId);
  }

  @Public()
  @Get(':provider')
  @UseGuards(OAuthGuard)
  @ApiOperation({
    summary: 'Initiate OAuth login with a provider (e.g. google, linkedin)',
  })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider name (google, linkedin)',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to provider consent screen',
  })
  @ApiResponse({
    status: 400,
    description: 'Unsupported provider',
    type: ErrorResponse,
  })
  oauth(@Param('provider') _provider: string): void {
    // The OAuth guard handles the redirect to the provider
  }

  @Public()
  @Get(':provider/callback')
  @UseGuards(OAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OAuth callback endpoint for provider' })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider name (google, linkedin)',
  })
  @ApiResponse({
    status: 200,
    description:
      'OAuth authentication successful, returns tokens and user profile',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing email or invalid parameters',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication failed',
    type: ErrorResponse,
  })
  async oauthCallback(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const passportUser = (req as Request & { user?: PassportOAuthUser }).user;

    if (!passportUser || !passportUser.profile) {
      throw new UnauthorizedException('Authentication failed');
    }

    const { profile, accessToken, refreshToken } = passportUser;

    const result = await this.oauthProcessorService.processOAuthLogin({
      provider: profile.provider || provider.toLowerCase(),
      providerUserId: profile.id,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      picture: profile.picture,
      accessToken,
      refreshToken,
    });

    this.setTokenCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    return result;
  }
}
