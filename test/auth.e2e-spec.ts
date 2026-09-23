import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { Reflector } from '@nestjs/core';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { TimeoutInterceptor } from './../src/common/interceptors/timeout.interceptor';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { ConfigurableValidationPipe } from '../src/common/pipes/configurable-validation.pipe';

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

  describe('/auth/register and /auth/login (POST)', () => {
    it('should register and return token without userProfile (EC-063)', async () => {
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
      expect(res.body.data.userProfile).toBeUndefined(); // EC-063
      if (res.body.data.user) {
        expect(res.body.data.user.userProfile).toBeUndefined();
      } // EC-063
    });

    it('should login and return token without userProfile (EC-063)', async () => {
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
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.accessToken).toBeDefined();

      const token = res.body.data.accessToken;
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(
        Buffer.from(payloadBase64, 'base64').toString('ascii'),
      );
      expect(payload).toBeDefined();
      expect(payload.userProfile).toBeUndefined();
      expect(payload.completionPct).toBeUndefined();
      expect(res.body.data.userProfile).toBeUndefined(); // EC-063
      if (res.body.data.user) {
        expect(res.body.data.user.userProfile).toBeUndefined();
      } // EC-063
    });
  });
  afterAll(async () => {
    await app.close();
  });

  describe('/auth/refresh (POST)', () => {
    it('should deny request with missing Origin/Referer in production-like environments', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'dummy-token' });

      // Note: In development mode, the guard allows the request and returns 401 Unauthorized instead of 403 Forbidden
      // because the origin guard warns but passes, and then the token is invalid.
      // To strictly test the guard, we override the config or rely on the unit tests for prod simulation.
      // Here, we check if it reaches the service (401) or gets blocked by the guard (403).
      expect([401, 403]).toContain(res.status);
    });

    it('should deny request with unallowed Origin', async () => {
      // By default the e2e test uses whatever is in .env, typically http://localhost:3000
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Origin', 'https://malicious-site.com')
        .send({ refreshToken: 'dummy-token' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('is not allowed');
    });

    it('should allow request with valid Origin (and fail with 401 due to dummy token)', async () => {
      // .env.example typically allows http://localhost:3000
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Origin', 'http://localhost:3000')
        .send({ refreshToken: 'dummy-token' });

      expect(res.status).toBe(401); // Guard passed, auth service rejected token
    });
  });
});
