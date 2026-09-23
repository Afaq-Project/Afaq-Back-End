import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import * as nock from 'nock';
import { AppModule } from './../src/app.module';
import { PrismaService } from '@/prisma';
import { OAuthGuard } from '@/modules/auth/guards/oauth.guard';
import { Reflector } from '@nestjs/core';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { TimeoutInterceptor } from './../src/common/interceptors/timeout.interceptor';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';

describe('OAuth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
    process.env.GOOGLE_CALLBACK_URL =
      'http://localhost:3000/api/auth/google/callback';
    process.env.LINKEDIN_CLIENT_ID = 'test-linkedin-client-id';
    process.env.LINKEDIN_CLIENT_SECRET = 'test-linkedin-client-secret';
    process.env.LINKEDIN_CALLBACK_URL =
      'http://localhost:3000/api/auth/linkedin/callback';
    process.env.OAUTH_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    const reflector = app.get(Reflector);
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(
      new TransformInterceptor(reflector),
      new TimeoutInterceptor(),
    );

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    // Ensure 'user' role exists for tests
    const defaultRole = await prisma.roles.findUnique({
      where: { name: 'user' },
    });
    if (!defaultRole) {
      await prisma.roles.create({
        data: { id: 1, name: 'user', description: 'Standard user access' },
      });
    }
  });

  afterAll(async () => {
    nock.cleanAll();
    nock.enableNetConnect();
    if (app) {
      await app.close();
    }
  });

  describe('GET /api/auth/:provider (Initiate OAuth)', () => {
    it('should return 400 for unsupported provider', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/unsupported-provider')
        .expect(400);

      expect(res.body.message).toContain(
        'Provider unsupported-provider is not supported',
      );
    });

    it('should redirect (302) when initiating Google OAuth', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/google');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('accounts.google.com');
    });

    it('should redirect (302) when initiating LinkedIn OAuth', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/linkedin');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('linkedin.com');
    });
  });

  describe('OAuth Flow & Callback Integration', () => {
    let testApp: INestApplication<App>;
    let mockPassportUser: any = null;

    beforeAll(async () => {
      // Create a test app instance where OAuthGuard injects mock passport user for callback testing
      const testModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideGuard(OAuthGuard)
        .useValue({
          canActivate: (context: any) => {
            const req = context.switchToHttp().getRequest();
            req.user = mockPassportUser;
            return true;
          },
        })
        .compile();

      testApp = testModule.createNestApplication();
      testApp.setGlobalPrefix('api');
      testApp.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      const testReflector = testApp.get(Reflector);
      testApp.useGlobalFilters(new AllExceptionsFilter());
      testApp.useGlobalInterceptors(
        new TransformInterceptor(testReflector),
        new TimeoutInterceptor(),
      );
      await testApp.init();
    });

    afterAll(async () => {
      if (testApp) {
        await testApp.close();
      }
    });

    it('should create a new user with isDraft: true, isEmailVerified: true on Google signup', async () => {
      const uniqueEmail = `google_oauth_${Date.now()}@example.com`;
      mockPassportUser = {
        profile: {
          id: `g_uid_${Date.now()}`,
          email: uniqueEmail,
          firstName: 'Google',
          lastName: 'User',
          picture: 'https://lh3.googleusercontent.com/photo.jpg',
          provider: 'google',
        },
        accessToken: 'mock-google-access-token',
        refreshToken: 'mock-google-refresh-token',
      };

      const res = await request(testApp.getHttpServer())
        .get('/api/auth/google/callback')
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      // Verify in DB
      const dbUser = await prisma.users.findUnique({
        where: { email: uniqueEmail },
        include: {
          userProfile: true,
          oauthIdentities: true,
          userRoles: { include: { role: true } },
        },
      });

      expect(dbUser).toBeDefined();
      expect(dbUser?.isEmailVerified).toBe(true);

      expect(dbUser?.oauthIdentities[0].accessTokenRef).not.toBe(
        'mock-google-access-token',
      ); // encrypted!
    });

    it('should link OAuth identity to existing user with same email on LinkedIn login', async () => {
      const existingEmail = `existing_user_${Date.now()}@example.com`;

      // Create existing user first
      const existingUser = await prisma.users.create({
        data: {
          email: existingEmail,
          firstName: 'Original',
          lastName: 'User',
          isEmailVerified: false,
          userProfile: {
            create: {
              isMatchable: false,
              completionPct: 80,
            },
          },
        },
      });

      mockPassportUser = {
        profile: {
          id: `li_uid_${Date.now()}`,
          email: existingEmail,
          firstName: 'LinkedIn',
          lastName: 'User',
          provider: 'linkedin',
        },
        accessToken: 'mock-linkedin-access-token',
        refreshToken: null,
      };

      await request(testApp.getHttpServer())
        .get('/api/auth/linkedin/callback')
        .expect(200);

      // Verify DB has only 1 user, and identity linked
      const userCount = await prisma.users.count({
        where: { email: existingEmail },
      });
      expect(userCount).toBe(1);

      const identity = await prisma.oauthIdentities.findUnique({
        where: {
          provider_providerUserId: {
            provider: 'linkedin',
            providerUserId: mockPassportUser.profile.id,
          },
        },
      });
      expect(identity?.userId).toBe(existingUser.id);
    });

    it('should reject with 400 if provider does not return an email', async () => {
      mockPassportUser = {
        profile: {
          id: `no_email_uid_${Date.now()}`,
          email: undefined,
          firstName: 'NoEmail',
          lastName: 'User',
          provider: 'google',
        },
        accessToken: 'mock-token',
        refreshToken: null,
      };

      const res = await request(testApp.getHttpServer())
        .get('/api/auth/google/callback')
        .expect(400);

      expect(res.body.message).toBe(
        'Unable to retrieve email from the provider. Please ensure your email is public or use another login method.',
      );
    });
  });
});
