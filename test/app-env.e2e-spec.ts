import { Test } from '@nestjs/testing';

describe('AppModule Environment Validation (e2e)', () => {
  const originalEnv = process.env;
  const originalNodeEnv = process.env.NODE_ENV;
  let originalAiUrl: string | undefined;

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
    originalAiUrl = process.env.DATABASE_AIService_URL;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalAiUrl !== undefined) {
      process.env.DATABASE_AIService_URL = originalAiUrl;
    }
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should throw an error if DATABASE_AIService_URL is missing', async () => {
    delete process.env.DATABASE_AIService_URL;
    const { AppModule } = require('../src/app.module');

    await expect(
      Test.createTestingModule({
        imports: [AppModule],
      }).compile(),
    ).rejects.toThrow();
  });
});
