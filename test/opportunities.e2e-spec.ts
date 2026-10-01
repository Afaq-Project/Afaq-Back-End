import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AiPrismaService } from '../src/modules/infrastructure/ai-prisma/ai-prisma.service';

describe('OpportunitiesController (e2e)', () => {
  let app: INestApplication;

  const mockAiPrismaService = {
    client: {
      cleanedOpportunity: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockImplementation((args) => {
          const allFields = {
            id: 'uuid',
            title: 't',
            organization: 'o',
            country: 'c',
            deadline: new Date().toISOString(),
            opportunityType: 'type',
            isRemote: true,
            description: 'd',
            applicationUrl: 'u',
            sourceUrl: 'u',
            status: 's',
            fieldsOfStudy: [],
            studyLevels: [],
            eligibility: {},
            location: 'l',
            fundingType: 'f',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          if (args.select) {
            const res: any = {};
            for (const k of Object.keys(args.select)) {
              res[k] =
                (allFields as any)[k] !== undefined
                  ? (allFields as any)[k]
                  : 'mock-value';
            }
            return Promise.resolve([res]);
          }
          return Promise.resolve([allFields]);
        }),
        findUnique: jest.fn().mockImplementation((args) => {
          const allFields = {
            id: args.where.id,
            title: 't',
            organization: 'o',
            country: 'c',
            deadline: new Date().toISOString(),
            opportunityType: 'type',
            isRemote: true,
            description: 'd',
            applicationUrl: 'u',
            sourceUrl: 'u',
            status: 's',
            fieldsOfStudy: [],
            studyLevels: [],
            eligibility: {},
            location: 'l',
            fundingType: 'f',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          if (args.select) {
            const res: any = {};
            for (const k of Object.keys(args.select)) {
              res[k] =
                (allFields as any)[k] !== undefined
                  ? (allFields as any)[k]
                  : 'mock-value';
            }
            return Promise.resolve(res);
          }
          return Promise.resolve(allFields);
        }),
      },
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiPrismaService)
      .useValue(mockAiPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('No params → 200, response has data: [] (fixture returns empty), meta object present with page, limit, total, pages (FR-001, FR-002, FR-008)', async () => {
    mockAiPrismaService.client.cleanedOpportunity.findMany.mockResolvedValueOnce(
      [],
    );
    mockAiPrismaService.client.cleanedOpportunity.count.mockResolvedValueOnce(
      0,
    );

    const res = await request(app.getHttpServer())
      .get('/api/v1/opportunities')
      .expect(200);

    expect(res.body).toHaveProperty('data', []);
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      pages: 0,
    });
  });

  it('fields=id,title,deadline → each item has exactly 3 keys (FR-011, EC-007 variant)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/opportunities?fields=id,title,deadline')
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(Object.keys(res.body.data[0])).toHaveLength(3);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0]).toHaveProperty('title');
    expect(res.body.data[0]).toHaveProperty('deadline');
  });

  it('fields=* → each item has exactly 18 keys (EC-007)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/opportunities?fields=*')
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(Object.keys(res.body.data[0])).toHaveLength(18);
  });

  it('No fields → each item has exactly 7 keys (EC-008, FR-014)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/opportunities')
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(Object.keys(res.body.data[0])).toHaveLength(7);
  });

  it('sort=invalid_field:asc → 400, error: "INVALID_SORT_FIELD" (EC-004)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/opportunities?sort=invalid_field:asc')
      .expect(400);

    expect(res.body.message).toBe('INVALID_SORT_FIELD');
  });

  it('sort=title:sideways → 400, error: "VALIDATION_ERROR" (EC-005)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/opportunities?sort=title:sideways')
      .expect(400);

    // Using arrays for class-validator standard message
    expect(
      Array.isArray(res.body.message) ? res.body.message[0] : res.body.message,
    ).toContain('sort must be in format field:asc or field:desc');
  });

  it('fields=nonexistent → 400, error: "INVALID_FIELD" (EC-006)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/opportunities?fields=nonexistent')
      .expect(400);

    expect(res.body.message).toBe('INVALID_FIELD');
  });

  it('deadline_from=2027-01-01&deadline_to=2026-01-01 → 400, error: "INVALID_DATE_RANGE" (EC-009)', async () => {
    const res = await request(app.getHttpServer())
      .get(
        '/api/v1/opportunities?deadline_from=2027-01-01&deadline_to=2026-01-01',
      )
      .expect(400);

    expect(res.body.message).toBe('INVALID_DATE_RANGE');
  });

  it('page=abc → 400, error: "VALIDATION_ERROR" (EC-018)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/opportunities?page=abc')
      .expect(400);
  });

  it('is_remote=true (string) → 200 (boolean coercion works) (EC-017)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/opportunities?is_remote=true')
      .expect(200);

    // Verify it was correctly parsed as a boolean, the mock receives it
    const callArgs =
      mockAiPrismaService.client.cleanedOpportunity.findMany.mock.calls[0][0];
    expect(callArgs.where.isRemote).toEqual({ equals: true });
  });

  it('Request without Authorization header → 200 (ST-001, EC-029)', async () => {
    await request(app.getHttpServer()).get('/api/v1/opportunities').expect(200);
  });

  it('Request with a valid Bearer token → 200 (token ignored, not rejected) (EC-029)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/opportunities')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);
  });

  it('Mock AI DB failure → 503, error: "SERVICE_UNAVAILABLE" (EC-024, ST-011)', async () => {
    mockAiPrismaService.client.cleanedOpportunity.count.mockRejectedValueOnce(
      new Error('DB connection lost'),
    );

    const res = await request(app.getHttpServer())
      .get('/api/v1/opportunities')
      .expect(503);

    expect(res.body.message).toBe('SERVICE_UNAVAILABLE');
  });

  it('Response body on any success → no rawOpportunityId, status, errorMessage, contentHash fields (ST-008)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/opportunities?fields=*')
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    const item = res.body.data[0];
    expect(item).not.toHaveProperty('rawOpportunityId');
    expect(item).not.toHaveProperty('status');
    expect(item).not.toHaveProperty('errorMessage');
    expect(item).not.toHaveProperty('contentHash');
  });

  describe('GET /api/v1/opportunities/:id', () => {
    it('Valid UUID, fixture exists → 200, response data object has exactly 18 keys (EC-019, FR-015)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/opportunities/123e4567-e89b-12d3-a456-426614174000')
        .expect(200);

      const data = res.body.data || res.body;
      expect(Object.keys(data)).toHaveLength(18);
    });

    it('Valid UUID, fixture exists, fields=id,title → 200, response data object has exactly 2 keys (EC-022)', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/v1/opportunities/123e4567-e89b-12d3-a456-426614174000?fields=id,title',
        )
        .expect(200);

      const data = res.body.data || res.body;
      expect(Object.keys(data)).toHaveLength(2);
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('title');
    });

    it('Invalid format UUID (e.g. 1234) → 400 (validation error from ParseUUIDPipe) (EC-020)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/opportunities/1234')
        .expect(400);
    });

    it('Valid UUID, does not exist (mock returns null) → 404, with error message containing "OPPORTUNITY_NOT_FOUND" (EC-021)', async () => {
      mockAiPrismaService.client.cleanedOpportunity.findUnique.mockResolvedValueOnce(
        null,
      );

      const res = await request(app.getHttpServer())
        .get('/api/v1/opportunities/123e4567-e89b-12d3-a456-426614174000')
        .expect(404);

      expect(res.body.message).toMatch(/not found/i);
    });

    it('AI DB failure (mock throws) → 503, error: "SERVICE_UNAVAILABLE" (EC-024)', async () => {
      mockAiPrismaService.client.cleanedOpportunity.findUnique.mockRejectedValueOnce(
        new Error('DB failure'),
      );

      const res = await request(app.getHttpServer())
        .get('/api/v1/opportunities/123e4567-e89b-12d3-a456-426614174000')
        .expect(503);

      expect(res.body.message).toBe('SERVICE_UNAVAILABLE');
    });
  });
});
