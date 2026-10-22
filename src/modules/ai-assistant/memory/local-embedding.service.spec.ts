// [OMA-W010-T003] Unit tests for LocalEmbeddingService using Google Gemini REST API with mock fallback
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LocalEmbeddingService } from './local-embedding.service';

describe('LocalEmbeddingService', () => {
  let service: LocalEmbeddingService;
  let configService: ConfigService;
  const originalFetch = global.fetch;

  const mockConfigValues: Record<string, string> = {
    GEMINI_API_KEY: 'test-gemini-api-key-12345',
    GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalEmbeddingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfigValues[key] ?? null),
          },
        },
      ],
    }).compile();

    service = module.get<LocalEmbeddingService>(LocalEmbeddingService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // [OMA-W010-T003] Successful API response returning exactly 384 dimensions
  it('should return 384 dimensions from Gemini API when call succeeds', async () => {
    // Arrange
    const sampleVector = Array.from({ length: 384 }, (_, i) =>
      Number(Math.sin(i).toFixed(6)),
    );
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        embedding: {
          values: sampleVector,
        },
      }),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    // Act
    const result = await service.generateEmbedding(
      'Personal statement for Oxford Chevening scholarship',
    );

    // Assert
    expect(result).toHaveLength(384);
    expect(result).toEqual(sampleVector);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=test-gemini-api-key-12345',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: {
            parts: [
              { text: 'Personal statement for Oxford Chevening scholarship' },
            ],
          },
          outputDimensionality: 384,
        }),
      }),
    );
  });

  // [OMA-W010-T003] Vector normalization (unit norm ≈ 1) for mock fallback embeddings
  it('should generate unit-norm normalized vectors (norm ≈ 1) for deterministic fallback', async () => {
    // Arrange - use missing API key to trigger fallback
    jest.spyOn(configService, 'get').mockReturnValue(null);
    delete process.env.GEMINI_API_KEY;

    // Act
    const result = await service.generateEmbedding(
      'Academic research proposal',
    );

    // Assert
    expect(result).toHaveLength(384);
    const normSq = result.reduce((sum, val) => sum + val * val, 0);
    expect(Math.sqrt(normSq)).toBeCloseTo(1, 1);
  });

  // [OMA-W010-T003] Empty or whitespace input returning mock embedding without network call
  it('should handle empty or whitespace text by returning deterministic mock embedding without network call', async () => {
    // Arrange
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;

    // Act
    const emptyResult = await service.generateEmbedding('');
    const whitespaceResult = await service.generateEmbedding('   \n\t  ');

    // Assert
    expect(emptyResult).toHaveLength(384);
    expect(whitespaceResult).toHaveLength(384);
    expect(emptyResult).toEqual(whitespaceResult);
    expect(fetchSpy).not.toHaveBeenCalled();

    const normSq = emptyResult.reduce((sum, val) => sum + val * val, 0);
    expect(Math.sqrt(normSq)).toBeCloseTo(1, 1);
  });

  // [OMA-W010-T003] Missing or 'mock' API key returning mock embedding without network call
  it('should return mock embedding without network call when API key is missing or set to "mock"', async () => {
    // Arrange
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;

    // Test with 'mock'
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'GEMINI_API_KEY') {
        return 'mock';
      }
      return null;
    });

    // Act 1
    const mockKeyResult = await service.generateEmbedding(
      'Machine learning resume',
    );

    // Assert 1
    expect(mockKeyResult).toHaveLength(384);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Test with short/empty key (< 5 characters)
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'GEMINI_API_KEY') {
        return 'abc';
      }
      return null;
    });

    // Act 2
    const shortKeyResult = await service.generateEmbedding(
      'Machine learning resume',
    );

    // Assert 2
    expect(shortKeyResult).toHaveLength(384);
    expect(shortKeyResult).toEqual(mockKeyResult);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // [OMA-W010-T003] API HTTP 429 / 500 error falling back to deterministic mock embedding
  it('should fall back to deterministic mock embedding when API responds with HTTP 429 rate limit or HTTP 500', async () => {
    // Arrange - HTTP 429
    const mock429Response = {
      ok: false,
      status: 429,
      text: jest
        .fn()
        .mockResolvedValue('Resource exhausted: Rate limit reached'),
    };
    global.fetch = jest.fn().mockResolvedValueOnce(mock429Response);

    // Act 1
    const rateLimitedResult = await service.generateEmbedding(
      'Leadership experience',
    );

    // Assert 1
    expect(rateLimitedResult).toHaveLength(384);
    const normSq429 = rateLimitedResult.reduce(
      (sum, val) => sum + val * val,
      0,
    );
    expect(Math.sqrt(normSq429)).toBeCloseTo(1, 1);

    // Arrange - HTTP 500
    const mock500Response = {
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal server error'),
    };
    global.fetch = jest.fn().mockResolvedValueOnce(mock500Response);

    // Act 2
    const serverErrorResult = await service.generateEmbedding(
      'Leadership experience',
    );

    // Assert 2
    expect(serverErrorResult).toHaveLength(384);
    expect(serverErrorResult).toEqual(rateLimitedResult);
  });

  // [OMA-W010-T003] Network timeout / AbortError falling back to mock embedding
  it('should fall back to deterministic mock embedding on network timeout or AbortError', async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('The operation was aborted due to timeout'));

    // Act
    const result = await service.generateEmbedding(
      'Community service statement',
    );

    // Assert
    expect(result).toHaveLength(384);
    const normSq = result.reduce((sum, val) => sum + val * val, 0);
    expect(Math.sqrt(normSq)).toBeCloseTo(1, 1);
  });

  // [OMA-W010-T003] API returning non-384 dimensional values falling back to mock embedding
  it('should fall back to deterministic mock embedding when API returns non-384 dimensional vector', async () => {
    // Arrange - returns 768 dimensions instead of 384
    const invalidVector = new Array(768).fill(0.01);
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        embedding: {
          values: invalidVector,
        },
      }),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    // Act
    const result = await service.generateEmbedding(
      'Undergraduate transcript evaluation',
    );

    // Assert
    expect(result).toHaveLength(384);
    const normSq = result.reduce((sum, val) => sum + val * val, 0);
    expect(Math.sqrt(normSq)).toBeCloseTo(1, 1);
  });
});
