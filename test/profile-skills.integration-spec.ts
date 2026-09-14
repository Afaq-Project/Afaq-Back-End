import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Profile Skills (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let skillId: string;

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

    await prisma.userSkills.deleteMany({
      where: { user: { email: 'skills_test@example.com' } },
    });
    await prisma.userProfiles.deleteMany({
      where: { user: { email: 'skills_test@example.com' } },
    });
    await prisma.users.deleteMany({
      where: { email: 'skills_test@example.com' },
    });

    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'skills_test@example.com',
      password: 'Password1!',
      firstName: 'S',
      lastName: 'T',
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'skills_test@example.com', password: 'Password1!' });

    userToken = login.body.accessToken;

    const skill = await prisma.skillsMaster.create({
      data: {
        name: 'Integration Test Skill',
        category: 'Test',
        isActive: true,
      },
    });
    skillId = skill.id;

    // init profile
    await request(app.getHttpServer())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${userToken}`);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /api/v1/profile/skills -> 401 unauthenticated', () => {
    return request(app.getHttpServer())
      .get('/api/v1/profile/skills')
      .expect(401);
  });

  it('POST /api/v1/profile/skills -> create skill', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/profile/skills')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ skillId, proficiency: 3 })
      .expect(201);

    expect(res.body.data.skillId).toBe(skillId);
  });

  it('POST /api/v1/profile/skills -> duplicate skill 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/profile/skills')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ skillId, proficiency: 3 })
      .expect(409);
  });

  it('GET /api/v1/profile/skills -> list skills', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/profile/skills')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].skillId).toBe(skillId);
  });

  it('DELETE /api/v1/profile/skills/:id -> remove skill', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/profile/skills/${skillId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/profile/skills')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(0);
  });
});
