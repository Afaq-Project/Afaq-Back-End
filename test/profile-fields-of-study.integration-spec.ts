import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Profile Fields of Study (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let fieldId: string;

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

    await prisma.userFieldsOfStudy.deleteMany({
      where: { user: { email: 'fields_test@example.com' } },
    });
    await prisma.userProfiles.deleteMany({
      where: { user: { email: 'fields_test@example.com' } },
    });
    await prisma.users.deleteMany({
      where: { email: 'fields_test@example.com' },
    });

    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'fields_test@example.com',
      password: 'Password1!',
      firstName: 'F',
      lastName: 'T',
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'fields_test@example.com', password: 'Password1!' });

    userToken = login.body.accessToken;

    const field = await prisma.fieldOfStudy.create({
      data: {
        name: 'Integration Test Field',
        isActive: true,
      },
    });
    fieldId = field.id;

    // init profile
    await request(app.getHttpServer())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${userToken}`);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /api/v1/profile/fields-of-study -> 401 unauthenticated', () => {
    return request(app.getHttpServer())
      .get('/api/v1/profile/fields-of-study')
      .expect(401);
  });

  it('POST /api/v1/profile/fields-of-study -> create field of study', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/profile/fields-of-study')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ fieldId })
      .expect(201);

    expect(res.body.data.fieldId).toBe(fieldId);
  });

  it('POST /api/v1/profile/fields-of-study -> duplicate field 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/profile/fields-of-study')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ fieldId })
      .expect(409);
  });

  it('GET /api/v1/profile/fields-of-study -> list fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/profile/fields-of-study')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].fieldId).toBe(fieldId);
  });

  it('DELETE /api/v1/profile/fields-of-study/:id -> remove field', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/profile/fields-of-study/${fieldId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/profile/fields-of-study')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(0);
  });
});
