const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { AppModule } = require('./src/app.module');
const { ValidationPipe, VersioningType } = require('@nestjs/common');
async function run() {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  await app.init();
  const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: 'hello' + Date.now() + '@example.com', password: 'Password1!', firstName: 'A', lastName: 'B' });
  console.log(JSON.stringify(res.body, null, 2));
  await app.close();
}
run();
