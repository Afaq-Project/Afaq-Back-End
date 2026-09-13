import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Profile Languages (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let languageId: string;

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
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    await prisma.userLanguages.deleteMany({
      where: { user: { email: 'lang_test@example.com' } },
    });
    await prisma.userProfiles.deleteMany({
      where: { user: { email: 'lang_test@example.com' } },
    });
    await prisma.users.deleteMany({
      where: { email: 'lang_test@example.com' },
    });

    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'lang_test@example.com',
      password: 'Password1!',
      firstName: 'L',
      lastName: 'T',
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'lang_test@example.com', password: 'Password1!' });

    userToken = login.body.accessToken;

    let lang = await prisma.languagesMaster.findFirst();
    if (!lang) {
      lang = await prisma.languagesMaster.create({
        data: { name: 'Integration Test Lang' },
      });
    }
    languageId = lang.id;

    // init profile
    await request(app.getHttpServer())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${userToken}`);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /api/v1/profile/languages -> 401 unauthenticated', () => {
    return request(app.getHttpServer())
      .get('/api/v1/profile/languages')
      .expect(401);
  });

  it('POST /api/v1/profile/languages -> create language', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/profile/languages')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ languageId, proficiency: 'fluent' })
      .expect(201);

    expect(res.body.data.languageId).toBe(languageId);
  });

  it('POST /api/v1/profile/languages -> duplicate language 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/profile/languages')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ languageId, proficiency: 'fluent' })
      .expect(409);
  });

  it('GET /api/v1/profile/languages -> list languages', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/profile/languages')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].languageId).toBe(languageId);
  });

  it('DELETE /api/v1/profile/languages/:id -> remove language', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/profile/languages/${languageId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/profile/languages')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(0);
  });
});
