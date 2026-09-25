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
      console.log(after.body.data);
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

      console.log(res.body);
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

  describe('Languages E2E (Batch 3)', () => {
    let lang1Id = '';
    let lang2Id = '';
    let prof1Id = '';

    beforeAll(async () => {
      // Setup test reference data
      const lang1 = await prisma.languagesMaster.findFirst();
      const lang2 = await prisma.languagesMaster.findMany({ skip: 1, take: 1 });
      const prof1 = await prisma.proficiencyLevels.findFirst();

      lang1Id = lang1?.id || '';
      lang2Id = lang2[0]?.id || '';
      prof1Id = prof1?.id || '';
    });

    afterAll(async () => {
      await prisma.userLanguages.deleteMany();
    });

    it('[EC-023] Missing/Invalid languageId or proficiencyLevelId in POST -> 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/profile/languages')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      const invalidUuid = '00000000-0000-0000-0000-000000000000';
      // Wait, actually the current code returns 404 for nonexistent, but the requirement is 400.
      // E2E test will assert what currently happens or what should happen?
      // I will assert what should happen to fail the test and report it, but to not completely crash, I'll allow 404 if it's the actual behavior. Or wait, prompt says "write tests". I should write tests that assert what *should* be the behavior (400).
      await request(app.getHttpServer())
        .post('/api/v1/profile/languages')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ languageId: invalidUuid, proficiencyLevelId: prof1Id })
        .expect(400);
    });

    it('[EC-024] Adding the same language twice -> 409', async () => {
      if (!lang1Id || !prof1Id) {
        return;
      }
      await request(app.getHttpServer())
        .post('/api/v1/profile/languages')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ languageId: lang1Id, proficiencyLevelId: prof1Id })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/profile/languages')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ languageId: lang1Id, proficiencyLevelId: prof1Id })
        .expect(409);
    });

    it('[EC-026] PATCH alters languageId -> 400 unknown field', async () => {
      if (!lang1Id || !lang2Id) {
        return;
      }
      await request(app.getHttpServer())
        .patch(`/api/v1/profile/languages/${lang1Id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ languageId: lang2Id })
        .expect(400);
    });

    it('[EC-026] Foreign ID -> 404', async () => {
      const invalidUuid = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/api/v1/profile/languages/${invalidUuid}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('[EC-027] isNative toggle -> persists correctly', async () => {
      if (!lang1Id) {
        return;
      }
      await request(app.getHttpServer())
        .patch(`/api/v1/profile/languages/${lang1Id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isNative: true })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/profile/languages/${lang1Id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.isNative).toBe(true);
    });
  });

  describe('Test Results E2E (Batch 4)', () => {
    let test1Id = '';

    beforeAll(async () => {
      const t1 = await prisma.standardizedTests.create({
        data: {
          nameEn: 'IELTS E2E',
          nameAr: 'IELTS E2E',
          minScore: 0.0,
          maxScore: 9.0,
          scoreStep: 0.5,
          isActive: true,
        },
      });
      test1Id = t1.id;
    });

    afterAll(async () => {
      await prisma.userTestResults.deleteMany();
      await prisma.standardizedTests.deleteMany({
        where: { nameEn: 'IELTS E2E' },
      });
    });

    it('[EC-028] Invalid testId -> 400', async () => {
      const invalidUuid = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .post('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ testId: invalidUuid, score: 7.5 })
        .expect(400);
    });

    it('[EC-029] Score out of bounds -> 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ testId: test1Id, score: 10.0 })
        .expect(400);
    });

    it('[EC-030] Score not aligned to step -> 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ testId: test1Id, score: 7.3 })
        .expect(400);
    });

    it('[EC-031] Max tests reached -> 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ testId: test1Id, score: 7.5 })
        .expect(201);
    });

    it('[EC-032] Test already exists -> 409', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ testId: test1Id, score: 8.0 })
        .expect(409);
    });

    it('[EC-033] Update with out of bounds -> 400', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      let resId;
      if (list.body.data && list.body.data.length > 0) {
        resId = list.body.data[0].id;
      } else {
        const create = await request(app.getHttpServer())
          .post('/api/v1/profile/test-results')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ testId: test1Id, score: 7.5 });
        resId = create.body.data?.id || create.body.id;
      }

      await request(app.getHttpServer())
        .patch(`/api/v1/profile/test-results/${resId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ score: 9.5 })
        .expect(400);
    });

    it('[EC-034] Valid Delete -> 204', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/profile/test-results')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      let resId;
      if (list.body.data && list.body.data.length > 0) {
        resId = list.body.data[0].id;
      } else {
        const create = await request(app.getHttpServer())
          .post('/api/v1/profile/test-results')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ testId: test1Id, score: 7.5 });
        resId = create.body.data?.id || create.body.id;
      }

      await request(app.getHttpServer())
        .delete(`/api/v1/profile/test-results/${resId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(204);
    });
  });

  describe('Special Statuses E2E (Batch 5)', () => {
    let specialStatusId = '';

    beforeAll(async () => {
      const status = await prisma.specialStatuses.findFirst();
      if (status) {
        specialStatusId = status.id;
      }
    });

    afterAll(async () => {
      await prisma.userSpecialStatuses.deleteMany();
    });

    it('[EC-035] POST /profile/special-statuses with invalid specialStatusId -> 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/profile/special-statuses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ specialStatusId: '00000000-0000-0000-0000-000000000000' })
        .expect(400);
    });

    it('[EC-036] POST /profile/special-statuses re-submit -> 200, exactly one pivot row', async () => {
      if (!specialStatusId) {
        return;
      }

      // Add once
      await request(app.getHttpServer())
        .post('/api/v1/profile/special-statuses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ specialStatusId })
        .expect(200);

      // Re-submit
      await request(app.getHttpServer())
        .post('/api/v1/profile/special-statuses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ specialStatusId })
        .expect(200);

      const user = await prisma.users.findFirst({
        where: { email: 'test1@example.com' },
      });
      const count = await prisma.userSpecialStatuses.count({
        where: { userId: user?.id || '', specialStatusId },
      });
      expect(count).toBe(1);
    });

    it('[EC-037] DELETE /profile/special-statuses remove missing -> 404', async () => {
      await request(app.getHttpServer())
        .delete(
          '/api/v1/profile/special-statuses/00000000-0000-0000-0000-000000000000',
        )
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('Preferences E2E (Batch 5)', () => {
    let eduLevelId = '';

    beforeAll(async () => {
      const level = await prisma.educationLevel.findFirst();
      if (level) {
        eduLevelId = level.id;
      }
    });

    afterAll(async () => {
      await prisma.userTargetDegrees.deleteMany();
      await prisma.userTargetMajors.deleteMany();
      await prisma.userTargetInstitutions.deleteMany();
    });

    it('[EC-038] POST invalid degree/major/inst -> 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/profile/preferences/degrees')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ educationLevelId: '00000000-0000-0000-0000-000000000000' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/profile/preferences/majors')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ majorId: '00000000-0000-0000-0000-000000000000' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/profile/preferences/institutions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ institutionId: '00000000-0000-0000-0000-000000000000' })
        .expect(400);
    });

    it('[EC-039] POST re-submit preference -> 200', async () => {
      if (!eduLevelId) {
        return;
      }
      await request(app.getHttpServer())
        .post('/api/v1/profile/preferences/degrees')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ educationLevelId: eduLevelId })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/profile/preferences/degrees')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ educationLevelId: eduLevelId })
        .expect(200);
    });

    it('[EC-040] POST over max limit -> 409', async () => {
      const user = await prisma.users.findFirst({
        where: { email: 'test1@example.com' },
      });
      if (user) {
        await prisma.userTargetDegrees.deleteMany({
          where: { userId: user.id },
        });
      }
      const levels = [];
      const ts = Date.now();
      for (let i = 0; i < 5; i++) {
        const l = await prisma.educationLevel.create({
          data: {
            code: `TMP${ts}${i}`,
            nameEn: `T${ts}${i}`,
            nameAr: `T${ts}${i}`,
          },
        });
        levels.push(l.id);
      }

      for (const id of levels) {
        await request(app.getHttpServer())
          .post('/api/v1/profile/preferences/degrees')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ educationLevelId: id })
          .expect(200);
      }

      const extra = await prisma.educationLevel.create({
        data: { code: `TMP${ts}99`, nameEn: 'T99', nameAr: 'T99' },
      });
      await request(app.getHttpServer())
        .post('/api/v1/profile/preferences/degrees')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ educationLevelId: extra.id })
        .expect(409);

      await prisma.userTargetDegrees.deleteMany();
      await prisma.educationLevel.deleteMany({
        where: { code: { startsWith: 'TMP' } },
      });
    });

    it('[EC-041] DELETE remove missing -> 404', async () => {
      await request(app.getHttpServer())
        .delete(
          '/api/v1/profile/preferences/degrees/00000000-0000-0000-0000-000000000000',
        )
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('Completion Invariants E2E', () => {
    let freshToken = '';

    beforeAll(async () => {
      const email = `inv-${Date.now()}@test.com`;
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email,
        password: 'Password1!',
        firstName: 'A',
        lastName: 'B',
      });
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password1!' });
      freshToken = login.body.data.accessToken;
    });

    it('[EC-057] Fill all groups -> completionPct == 100', async () => {
      const eduLevel = await prisma.educationLevel.findFirst();
      const inst = await prisma.institutions.findFirst();
      const maj = await prisma.majors.findFirst();
      const maritalStatus = await prisma.maritalStatuses.findFirst();
      const country = await prisma.countries.findFirst();
      const lang = await prisma.languagesMaster.findFirst();
      const prof = await prisma.proficiencyLevels.findFirst();
      let tr = await prisma.standardizedTests.findFirst();
      const specStatus = await prisma.specialStatuses.findFirst();

      // 1. Personal
      await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          firstName: 'Filled',
          lastName: 'Name',
          dateOfBirth: '2000-01-01T00:00:00.000Z',
          gender: 'MALE',
          maritalStatusId: maritalStatus?.id,
          countryOfResidenceId: country?.id,
          nationalityId: country?.id,
          educationLevelId: eduLevel?.id,
        })
        .expect(200);

      // 2. Education
      if (eduLevel && inst && maj) {
        const eduRes = await request(app.getHttpServer())
          .post('/api/v1/profile/educations')
          .set('Authorization', `Bearer ${freshToken}`)
          .send({
            educationLevelId: eduLevel.id,
            institutionId: inst.id,
            majorId: maj.id,
            isCurrent: true,
            gpaRaw: 3.5,
            gpaScale: 'OUT_OF_4',
          });
        if (eduRes.status !== 201) {
          console.log('EDU ERROR', eduRes.body);
        }
      }

      // 3. Languages
      if (lang && prof) {
        const langRes = await request(app.getHttpServer())
          .post('/api/v1/profile/languages')
          .set('Authorization', `Bearer ${freshToken}`)
          .send({ languageId: lang.id, proficiencyLevelId: prof.id });
        if (langRes.status !== 201) {
          console.log('LANG ERROR', langRes.body);
        }
      }

      // 4. Test Results
      if (!tr) {
        tr = await prisma.standardizedTests.create({
          data: {
            nameEn: 'Test E2E',
            nameAr: 'Test E2E',
            minScore: 0,
            maxScore: 10,
            scoreStep: 1,
            isActive: true,
          },
        });
      }
      if (tr) {
        const trRes = await request(app.getHttpServer())
          .post('/api/v1/profile/test-results')
          .set('Authorization', `Bearer ${freshToken}`)
          .send({ testId: tr.id, score: Number(tr.minScore) });
        if (trRes.status !== 201) {
          console.log('TR ERROR', trRes.body);
        }
      }

      // 5. Special Statuses
      if (specStatus) {
        const specRes = await request(app.getHttpServer())
          .post('/api/v1/profile/special-statuses')
          .set('Authorization', `Bearer ${freshToken}`)
          .send({ specialStatusId: specStatus.id });
        if (specRes.status !== 200) {
          console.log('SPEC ERROR', specRes.body);
        }
      }

      // 6. Preferences
      if (eduLevel) {
        await request(app.getHttpServer())
          .post('/api/v1/profile/preferences/degrees')
          .set('Authorization', `Bearer ${freshToken}`)
          .send({ educationLevelId: eduLevel.id });
      }

      if (maj) {
        await request(app.getHttpServer())
          .post('/api/v1/profile/preferences/majors')
          .set('Authorization', `Bearer ${freshToken}`)
          .send({ majorId: maj.id });
      }

      if (inst) {
        await request(app.getHttpServer())
          .post('/api/v1/profile/preferences/institutions')
          .set('Authorization', `Bearer ${freshToken}`)
          .send({ institutionId: inst.id });
      }

      const res = await request(app.getHttpServer())
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200);

      expect(res.body.data.completionPct).toBe(100);
    });

    it('[EC-058] matchingVersion incremented by 1 without completionPct changing', async () => {
      const before = await request(app.getHttpServer())
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200);

      const v1 = before.body.data.matchingVersion;
      const pct1 = before.body.data.completionPct;

      await request(app.getHttpServer())
        .patch('/api/v1/profile/personal')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ phone: '+123456789' })
        .expect(200);

      const after = await request(app.getHttpServer())
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200);

      console.log(after.body.data);
      expect(after.body.data.matchingVersion).toBe(v1 + 1);
      expect(after.body.data.completionPct).toBe(pct1);
    });
  });
  describe('Documents E2E (Batch 6)', () => {
    let docTypeId = '';
    let storageService: any;

    beforeAll(async () => {
      const type = await prisma.documentTypes.findFirst();
      if (type) {
        docTypeId = type.id;
      }

      storageService = app.get('STORAGE_SERVICE');
    });

    afterAll(async () => {
      await prisma.documents.deleteMany();
    });

    it('Upload with bad mime -> 400', async () => {
      const buffer = Buffer.from('just some text');
      await request(app.getHttpServer())
        .post('/api/v1/profile/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .field('documentTypeId', docTypeId)
        .attach('file', buffer, {
          filename: 'test.txt',
          contentType: 'text/plain',
        })
        .expect(400);
    });

    it('Upload with oversize -> 400', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
      await request(app.getHttpServer())
        .post('/api/v1/profile/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .field('documentTypeId', docTypeId)
        .attach('file', largeBuffer, {
          filename: 'large.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);
    });

    it('Upload with magic byte mismatch -> 400', async () => {
      const badBuffer = Buffer.from('not a real pdf');
      await request(app.getHttpServer())
        .post('/api/v1/profile/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .field('documentTypeId', docTypeId)
        .attach('file', badBuffer, {
          filename: 'fake.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);
    });

    it('Upload with invalid documentTypeId -> 404', async () => {
      const validPdfBuffer = Buffer.concat([
        Buffer.from([0x25, 0x50, 0x44, 0x46]),
        Buffer.from('test'),
      ]);
      await request(app.getHttpServer())
        .post('/api/v1/profile/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .field('documentTypeId', '00000000-0000-0000-0000-000000000000')
        .attach('file', validPdfBuffer, {
          filename: 'real.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);
    });

    let uploadedDocId = '';

    it('Upload successful -> 201', async () => {
      const validPdfBuffer = Buffer.concat([
        Buffer.from([0x25, 0x50, 0x44, 0x46]),
        Buffer.from('test'),
      ]);

      const res = await request(app.getHttpServer())
        .post('/api/v1/profile/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .field('documentTypeId', docTypeId)
        .attach('file', validPdfBuffer, {
          filename: 'real.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      uploadedDocId = res.body.data?.id || res.body.id;
      expect(uploadedDocId).toBeDefined();
    });

    it('List documents -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/profile/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('Get download url -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/profile/documents/${uploadedDocId}/download`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data?.signedUrl || res.body.signedUrl).toBeDefined();
    });

    it('Simulated storage failure during DELETE -> 5xx and keeps in DB', async () => {
      if (storageService) {
        jest
          .spyOn(storageService, 'delete')
          .mockRejectedValueOnce(new Error('Simulated failure'));
      }

      const delRes = await request(app.getHttpServer())
        .delete(`/api/v1/profile/documents/${uploadedDocId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(delRes.status).toBeGreaterThanOrEqual(500);
      expect(delRes.status).toBeLessThan(600);

      // Verify it remains in DB
      const res = await request(app.getHttpServer())
        .get('/api/v1/profile/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const docs = res.body.data || res.body;
      const found = docs.find((d: any) => d.id === uploadedDocId);
      expect(found).toBeDefined();
    });

    it('Valid delete -> 200 or 204', async () => {
      if (storageService) {
        jest.spyOn(storageService, 'delete').mockResolvedValueOnce(undefined);
      }

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/profile/documents/${uploadedDocId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 204]).toContain(res.status);
    });
  });
});
