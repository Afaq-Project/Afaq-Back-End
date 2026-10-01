import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

describe('AppModule Environment Validation (e2e)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should throw an error if DATABASE_AIService_URL is missing', async () => {
    delete process.env.DATABASE_AIService_URL;

    await expect(
      Test.createTestingModule({
        imports: [AppModule],
      }).compile(),
    ).rejects.toThrow();
  });
});
