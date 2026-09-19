import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { Reflector } from '@nestjs/core';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { TimeoutInterceptor } from './../src/common/interceptors/timeout.interceptor';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // Provide OAuth env vars so strategies don't throw at startup
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health', () => {
    it('/api/health (GET) should return 200', () => {
      return request(app.getHttpServer()).get('/api/health').expect(200);
    });
  });
});
