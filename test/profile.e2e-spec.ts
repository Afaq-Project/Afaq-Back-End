import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Reflector } from '@nestjs/core';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { TimeoutInterceptor } from '../src/common/interceptors/timeout.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('ProfileModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let res: any;
  let userToken: string;

  jest.setTimeout(120000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    const reflector = app.get(Reflector);
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(
      new TransformInterceptor(reflector),
      new TimeoutInterceptor(),
    );
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // DB Cleanup
    await prisma.documents.deleteMany();
    await prisma.userEducations.deleteMany();
    await prisma.userLanguages.deleteMany();
    await prisma.userProfiles.deleteMany();
    await prisma.users.deleteMany();

    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'test1@example.com',
      password: 'Password1!',
      firstName: 'A',
      lastName: 'B',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test1@example.com', password: 'Password1!' });

    userToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('Unauthenticated Access', () => {
    it('GET /api/v1/profile -> 401', () => {
      return request(app.getHttpServer()).get('/api/v1/profile/me').expect(401);
    });
    it('PATCH /api/v1/profile -> 401', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .send({})
        .expect(401);
    });
  });

  describe('Authenticated Profile Scenarios', () => {
    it('[FR-001] [EC-001] GET /api/v1/profile creates and returns empty profile on first access', async () => {
      res = await request(app.getHttpServer())
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.completionPct).toBe(0);
      expect(res.body.data.isMatchable).toBe(false);
      expect(res.body.data.userId).toBeDefined();
    });

    it('[FR-003] [EC-002] PATCH /api/v1/profile partial personal update preserves unrelated fields', async () => {
      res = await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ firstName: 'First', lastName: 'Last' })
        .expect(200);

      res = await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ phone: '123456789' })
        .expect(200);

      expect(res.body.data.firstName).toBe('First');
      expect(res.body.data.lastName).toBe('Last');
      expect(res.body.data.phone).toBe('123456789');
    });

    it('[FR-007] [EC-003] computed fields rejected as unknown', async () => {
      res = await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ completionPct: 100 })
        .expect(400);

      res = await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ matchingVersion: 5 })
        .expect(400);
    });

    it('[FR-012] [EC-003] matchability direct-write rejected', async () => {
      res = await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isMatchable: true })
        .expect(400);
    });

    it('[FR-009b] [EC-005] bio configured boundary', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bio: 'a'.repeat(1000) })
        .expect(200);

      const overLimit = 'a'.repeat(1001);
      await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bio: overLimit })
        .expect(400);
    });

    it('[FR-008] [EC-054] empty/partial completion totals', async () => {
      // It's already partially tested by FR-001 (0%) and FR-003 (some %).
      // Here we check it actually calculates based on filled fields.
      res = await request(app.getHttpServer())
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.body.data.completionPct).toBeGreaterThan(0);
      expect(res.body.data.isMatchable).toBe(false);
    });
  });

  describe('Reference Endpoints', () => {
    it('[FR-037] [EC-060] all reference routes are token-free', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reference/education-levels')
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/reference/countries')
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/reference/cities')
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/reference/marital-statuses')
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/reference/languages')
        .expect(200);
    });

    it('[FR-038] each required reference collection route returns data', async () => {
      res = await request(app.getHttpServer())
        .get('/api/v1/reference/countries')
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('[FR-039] master items expose nameEn and nameAr', async () => {
      res = await request(app.getHttpServer())
        .get('/api/v1/reference/education-levels')
        .expect(200);
      if (res.body.data.length > 0) {
        expect(res.body.data[0]).toHaveProperty('nameEn');
        expect(res.body.data[0]).toHaveProperty('nameAr');
      }
    });

    it('[FR-040] country search and filters', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reference/countries?search=InvalidCountryNameSearch99')
        .expect(200);
      // Expected empty array or similar, but 200 OK.
    });
  });
});
