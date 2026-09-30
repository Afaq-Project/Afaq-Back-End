import { AuthService } from '../src/modules/auth/auth.service';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as crypto from 'crypto';
import { AppModule } from './../src/app.module';
import { Reflector } from '@nestjs/core';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { TimeoutInterceptor } from './../src/common/interceptors/timeout.interceptor';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { ConfigurableValidationPipe } from '../src/common/pipes/configurable-validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.getHttpAdapter().getInstance().set('trust proxy', 1);

    const reflector = app.get(Reflector);
    app.useGlobalPipes(
      new ConfigurableValidationPipe(reflector, {
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(
      new TransformInterceptor(reflector),
      new TimeoutInterceptor(),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/auth/register and /auth/login (POST)', () => {
    it('should register and return NO tokens', async () => {
      const email = `test-${Date.now()}@example.com`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password1!',
          firstName: 'John',
          lastName: 'Doe',
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.accessToken).toBeUndefined();
      expect(res.body.data.refreshToken).toBeUndefined();
      expect(res.body.data.message).toContain('Registration successful');
      if (res.body.data.user) {
        expect(res.body.data.user.userProfile).toBeUndefined();
      }
    });

    it('should return AUTH_EMAIL_NOT_VERIFIED for unverified login (ST-001)', async () => {
      const email = `test-login-${Date.now()}@example.com`;
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email,
        password: 'Password1!',
        firstName: 'John',
        lastName: 'Doe',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'Password1!',
        })
        .expect(403);

      expect(res.body.errors[0].code).toBe('AUTH_EMAIL_NOT_VERIFIED');
    });

    it('should verify email and then allow login', async () => {
      const email = `test-verify-${Date.now()}@example.com`;
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email,
        password: 'Password1!',
        firstName: 'John',
        lastName: 'Doe',
      });

      const prismaService = app.get(PrismaService);
      const redisService = app.get(RedisService);

      const user = await prismaService.users.findUnique({ where: { email } });
      expect(user).toBeDefined();

      const rawToken = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await redisService.client.set(
        `vt:current:${user!.id}`,
        hash,
        'EX',
        86400,
      );
      await redisService.client.set(`vt:${hash}`, user!.id, 'EX', 86400);

      await request(app.getHttpServer())
        .get(`/api/v1/auth/verify-email?token=${rawToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'Password1!',
        })
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.accessToken).toBeDefined();
    });
  });

  describe('/auth/refresh (POST)', () => {
    it('should deny request with missing Origin/Referer in production-like environments', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'dummy-token' });

      expect([401, 403]).toContain(res.status);
    });

    it('should deny request with unallowed Origin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Origin', 'https://malicious-site.com')
        .send({ refreshToken: 'dummy-token' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('is not allowed');
    });

    it('should allow request with valid Origin (and fail with 401 due to dummy token)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Origin', 'http://localhost:3000')
        .send({ refreshToken: 'dummy-token' });

      expect(res.status).toBe(401);
    });
  });

  describe('/auth/forgot-password and /auth/reset-password (POST)', () => {
    it('should return success message for unknown email (ST-006 anti-enumeration)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(res.body.data.message).toBe(
        'If this email is registered, a password reset link has been sent.',
      );
    });

    it('should successfully request password reset for existing user', async () => {
      const email = `test-forgot-${Date.now()}@example.com`;
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email,
        password: 'Password1!',
        firstName: 'John',
        lastName: 'Doe',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '192.168.1.101')
        .send({ email })
        .expect(200);

      expect(res.body.data.message).toBe(
        'If this email is registered, a password reset link has been sent.',
      );
    });

    it('should reset password with valid token', async () => {
      const email = `test-reset-${Date.now()}@example.com`;
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email,
        password: 'Password1!',
        firstName: 'John',
        lastName: 'Doe',
      });

      const prismaService = app.get(PrismaService);
      const redisService = app.get(RedisService);

      const user = await prismaService.users.findUnique({ where: { email } });
      expect(user).toBeDefined();

      const rawToken = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await redisService.client.set(
        `prt:current:${user!.id}`,
        hash,
        'EX',
        3600,
      );
      await redisService.client.set(`prt:${hash}`, user!.id, 'EX', 3600);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          password: 'NewPassword1!',
          confirmPassword: 'NewPassword1!',
        })
        .expect(200);

      expect(res.body.data.message).toBe(
        'Password has been reset successfully. Please log in with your new password.',
      );

      // Login with new password
      // Since it's a new user, they need email verified to login
      const vtToken = crypto.randomBytes(32).toString('hex');
      const vtHash = crypto.createHash('sha256').update(vtToken).digest('hex');
      await redisService.client.set(
        `vt:current:${user!.id}`,
        vtHash,
        'EX',
        86400,
      );
      await redisService.client.set(`vt:${vtHash}`, user!.id, 'EX', 86400);

      await request(app.getHttpServer())
        .get(`/api/v1/auth/verify-email?token=${vtToken}`)
        .expect(200);

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'NewPassword1!',
        })
        .expect(200);

      expect(loginRes.body.data.accessToken).toBeDefined();
    });
  });

  describe('/auth/change-password (POST)', () => {
    it('should return 400 when trying to change password for SSO-only account', async () => {
      // Create SSO-only user (no password)
      const email = `sso-user-${Date.now()}@example.com`;
      const prismaService = app.get(PrismaService);
      const ssoUser = await prismaService.users.create({
        data: {
          email,
          firstName: 'SSO',
          lastName: 'User',
          isEmailVerified: true,
          isActive: true,
        },
      });

      // Set tv in Redis
      const redisService = app.get(RedisService);
      await redisService.client.set(`tv:${ssoUser.id}`, '1');

      // Generate access token for the SSO user
      const jwtService = app.get(JwtService);
      const accessToken = await jwtService.signAsync({
        sub: ssoUser.id,
        email: ssoUser.email,
        role: 'user',
        tokenVersion: 1,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'AnyPassword1!',
          newPassword: 'NewPassword1!',
          confirmNewPassword: 'NewPassword1!',
        })
        .expect(400);

      expect(res.body.errors[0].message).toBe('Cannot change SSO password');
    });

    it('should return 400 for invalid current credentials (ST-010)', async () => {
      const email = `change-invalid-${Date.now()}@example.com`;
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email,
        password: 'Password1!',
        firstName: 'John',
        lastName: 'Doe',
      });

      const prismaService = app.get(PrismaService);
      const user = await prismaService.users.findUnique({ where: { email } });
      await prismaService.users.update({
        where: { id: user!.id },
        data: { isEmailVerified: true },
      });

      // Login to get access token
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password1!' })
        .expect(200);

      const accessToken = loginRes.body.data.accessToken;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword1!',
          newPassword: 'NewPassword1!',
          confirmNewPassword: 'NewPassword1!',
        })
        .expect(400);

      expect(res.body.errors[0].message).toBe('Invalid current password');
    });

    it('should successfully change password', async () => {
      const email = `change-valid-${Date.now()}@example.com`;
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email,
        password: 'Password1!',
        firstName: 'John',
        lastName: 'Doe',
      });

      const prismaService = app.get(PrismaService);
      const user = await prismaService.users.findUnique({ where: { email } });
      await prismaService.users.update({
        where: { id: user!.id },
        data: { isEmailVerified: true },
      });

      // Login to get access token
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password1!' })
        .expect(200);

      const accessToken = loginRes.body.data.accessToken;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password1!',
          newPassword: 'NewPassword1!',
          confirmNewPassword: 'NewPassword1!',
        })
        .expect(200);

      expect(res.body.data.message).toBe('Password changed successfully.');

      // Attempt login with old password should fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password1!' })
        .expect(401);

      // Attempt login with new password should succeed
      const newLoginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'NewPassword1!' })
        .expect(200);

      expect(newLoginRes.body.data.accessToken).toBeDefined();
    });
  });

  describe('/auth/resend-verification (POST)', () => {
    it('should enforce 1/min rate limit (ST-004, ST-005)', async () => {
      const email = `test-resend-limit-${Date.now()}@example.com`;
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email,
        password: 'Password1!',
        firstName: 'Limit',
        lastName: 'Test',
      });

      // First request should succeed
      await request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .send({ email })
        .expect(200);

      // Second request immediately should return 429
      await request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .send({ email })
        .expect(429);
    });

    it('should explicitly invalidate previous token upon requesting a new one (ST-002, ST-003)', async () => {
      const email = `test-resend-replay-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', '192.168.1.100')
        .send({
          email,
          password: 'Password1!',
          firstName: 'Replay',
          lastName: 'Test',
        });

      const redisService = app.get(RedisService);
      const prismaService = app.get(PrismaService);

      const user = await prismaService.users.findUnique({ where: { email } });
      const currentHash = await redisService.client.get(
        `vt:current:${user!.id}`,
      );

      await request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .set('X-Forwarded-For', '192.168.1.100')
        .send({ email })
        .expect(200);

      const oldTokenExists = await redisService.client.get(`vt:${currentHash}`);
      expect(oldTokenExists).toBeNull();
    });
  });

  describe('Admin Forced Reset (ST-008, ST-012)', () => {
    it('should invalidate active JWT when forcePasswordReset is called (ST-008)', async () => {
      const email = `force-reset-${Date.now()}@example.com`;
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email,
        password: 'Password1!',
        firstName: 'Force',
        lastName: 'Reset',
      });

      const prismaService = app.get(PrismaService);
      const user = await prismaService.users.findUnique({ where: { email } });
      await prismaService.users.update({
        where: { id: user!.id },
        data: { isEmailVerified: true },
      });

      // Login to get token
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password1!' })
        .expect(200);

      const accessToken = loginRes.body.data.accessToken;

      // Verify token works
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Force password reset
      const authService = app.get(AuthService);
      await authService.forcePasswordReset(user!.id);

      // Verify token is now invalid (401)
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });

    it('should return 403 AUTH_PASSWORD_RESET_REQUIRED when logging in with a locked account (ST-012)', async () => {
      const email = `force-reset-login-${Date.now()}@example.com`;
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email,
        password: 'Password1!',
        firstName: 'Locked',
        lastName: 'Login',
      });

      const prismaService = app.get(PrismaService);
      const user = await prismaService.users.findUnique({ where: { email } });
      await prismaService.users.update({
        where: { id: user!.id },
        data: { isEmailVerified: true },
      });

      // Force password reset
      const authService = app.get(AuthService);
      await authService.forcePasswordReset(user!.id);

      // Attempt login
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password1!' })
        .expect(403);

      expect(res.body.errors[0].code).toBe('AUTH_PASSWORD_RESET_REQUIRED');
    });
  });
});
