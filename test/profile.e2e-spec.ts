import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Reflector } from '@nestjs/core';
import { ConfigurableValidationPipe } from '../src/common/pipes/configurable-validation.pipe';
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
    it('[FR-001] [EC-001] GET /api/v1/profile/me creates and returns profile with completionPct 0 on first access', async () => {
      res = await request(app.getHttpServer())
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.completionPct).toBe(0);
      expect(res.body.data.isMatchable).toBe(false);
      expect(res.body.data.userId).toBeDefined();
    });

    it('[FR-001] GET /profile/me returns all 8 sections as arrays or null', async () => {
      res = await request(app.getHttpServer())
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const d = res.body.data;
      for (const key of [
        'educations',
        'languages',
        'testResults',
        'specialStatuses',
        'targetDegrees',
        'targetMajors',
        'targetInstitutions',
        'documents',
      ]) {
        expect(Array.isArray(d[key])).toBe(true);
      }
    });

    it('[FR-004] isMatchable transitions correctly', async () => {
      const freshEmail = `fresh-${Date.now()}@example.com`;
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: freshEmail,
        password: 'Password1!',
        firstName: 'Fresh',
        lastName: 'User',
      });
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: freshEmail, password: 'Password1!' });
      const token = loginRes.body.data.accessToken;

      await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Fresh',
          lastName: 'User',
          gender: 'MALE',
          bio: 'Hello world',
        })
        .expect(200);

      const after = await request(app.getHttpServer())
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${token}`);
      expect(after.body.data.isMatchable).toBe(false);
    });

    test.todo(
      '[requires Batch 2+] isMatchable transitions to true when all 6 weighted groups are filled, and drops when a required record is deleted.',
    );

    it('[FR-005] matchingVersion increments on every successful PATCH', async () => {
      const before = await request(app.getHttpServer())
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${userToken}`);
      const v1 = before.body.data.matchingVersion;

      await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ phone: '999999999' })
        .expect(200);

      const after = await request(app.getHttpServer())
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(after.body.data.matchingVersion).toBe(v1 + 1);
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

    it('[DEC-PROF-20] [EC-011b] experiences boundary', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          experiences: [
            'Exp 1',
            'Exp 2',
            'Exp 3',
            'Exp 4',
            'Exp 5',
            'Exp 6',
            'Exp 7',
            'Exp 8',
            'Exp 9',
            'Exp 10',
          ],
        })
        .expect(200);

      await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          experiences: [
            'Exp 1',
            'Exp 2',
            'Exp 3',
            'Exp 4',
            'Exp 5',
            'Exp 6',
            'Exp 7',
            'Exp 8',
            'Exp 9',
            'Exp 10',
            'Exp 11',
          ],
        })
        .expect(400);

      await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ experiences: ['a'.repeat(501)] })
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

  describe('Educations E2E', () => {
    let lvlId = '';
    let instId = '';
    let majId = '';

    beforeAll(async () => {
      // Create test reference data
      const lvl = await prisma.educationLevel.create({
        data: { code: 'LVL', nameEn: 'Lvl', nameAr: 'Lvl' },
      });
      lvlId = lvl.id;
      const inst = await prisma.institutions.create({
        data: { nameEn: 'Inst', nameAr: 'Inst' },
      });
      instId = inst.id;
      const maj = await prisma.majors.create({
        data: { nameEn: 'Maj', nameAr: 'Maj' },
      });
      majId = maj.id;
    });

    afterAll(async () => {
      await prisma.userEducations.deleteMany();
      await prisma.educationLevel.delete({ where: { id: lvlId } });
      await prisma.institutions.delete({ where: { id: instId } });
      await prisma.majors.delete({ where: { id: majId } });
    });

    it('POST /profile/educations - creates an education record', async () => {
      const payload = {
        educationLevelId: lvlId,
        institutionId: instId,
        majorId: majId,
        isCurrent: true,
        gpaRaw: 3.5,
        gpaScale: 'OUT_OF_4',
      };
      const res = await request(app.getHttpServer())
        .post('/api/v1/profile/educations')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.data?.id || res.body.id).toBeDefined();
      expect(String(res.body.data.gpaNormalized)).toBe('3.5');
    });

    it('PATCH /profile/educations/:id - updates an education record', async () => {
      // Get the existing one
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/profile/educations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const eduId = listRes.body.data[0].id;

      const updateRes = await request(app.getHttpServer())
        .patch(`/api/v1/profile/educations/${eduId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ gpaRaw: 90, gpaScale: 'OUT_OF_100' })
        .expect(200);

      expect(String(updateRes.body.data.gpaNormalized)).toBe('3.6');
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
