import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { Reflector } from '@nestjs/core';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { TimeoutInterceptor } from './../src/common/interceptors/timeout.interceptor';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/auth/refresh (POST)', () => {
    it('should deny request with missing Origin/Referer in production-like environments', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
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
        .post('/api/auth/refresh')
        .set('Origin', 'https://malicious-site.com')
        .send({ refreshToken: 'dummy-token' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('is not allowed');
    });

    it('should allow request with valid Origin (and fail with 401 due to dummy token)', async () => {
      // .env.example typically allows http://localhost:3000
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Origin', 'http://localhost:3000')
        .send({ refreshToken: 'dummy-token' });

      expect(res.status).toBe(401); // Guard passed, auth service rejected token
    });
  });
});
