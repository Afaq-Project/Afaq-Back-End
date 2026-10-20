// [OMA-W006-T002] Test local in-process embedding service with 384 dimensions
import { Test, TestingModule } from '@nestjs/testing';
import { LocalEmbeddingService } from './local-embedding.service';

// Mock @xenova/transformers to control pipeline behavior in unit tests
const mockPipelineFn = jest.fn();
jest.mock('@xenova/transformers', () => ({
  pipeline: (...args: unknown[]) => mockPipelineFn(...args),
}));

describe('LocalEmbeddingService', () => {
  let service: LocalEmbeddingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalEmbeddingService],
    }).compile();

    service = module.get<LocalEmbeddingService>(LocalEmbeddingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // [OMA-W006-T002] Test local in-process embedding service with 384 dimensions
  describe('generateEmbedding', () => {
    it('should generate a 384-dimensional normalized embedding via the transformer pipeline', async () => {
      // Arrange
      const mockVector = new Float32Array(384).fill(0.05);
      const mockExtractor = jest.fn().mockResolvedValue({ data: mockVector });
      mockPipelineFn.mockResolvedValue(mockExtractor);

      const input = 'Personal statement for Oxford Chevening scholarship';

      // Act
      const result = await service.generateEmbedding(input);

      // Assert
      expect(result).toHaveLength(384);
      expect(mockPipelineFn).toHaveBeenCalledWith(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { quantized: true },
      );
      expect(mockExtractor).toHaveBeenCalledWith(input, {
        pooling: 'mean',
        normalize: true,
      });
      expect(result[0]).toBeCloseTo(0.05);
    });

    // [OMA-W006-T002] Test local in-process embedding service with 384 dimensions
    it('should handle empty or whitespace text by returning deterministic mock embedding without calling pipeline', async () => {
      // Arrange
      const mockExtractor = jest.fn();
      mockPipelineFn.mockResolvedValue(mockExtractor);

      // Act
      const emptyResult = await service.generateEmbedding('');
      const whitespaceResult = await service.generateEmbedding('   \n\t  ');

      // Assert
      expect(emptyResult).toHaveLength(384);
      expect(whitespaceResult).toHaveLength(384);
      expect(emptyResult).toEqual(whitespaceResult);
      expect(mockExtractor).not.toHaveBeenCalled();

      // Verify normalization: norm ≈ 1
      const normSq = emptyResult.reduce((sum, val) => sum + val * val, 0);
      expect(Math.sqrt(normSq)).toBeCloseTo(1, 1);
    });

    // [OMA-W006-T002] Test local in-process embedding service with 384 dimensions
    it('should fall back to deterministic mock embedding if extractor throws an error', async () => {
      // Arrange
      const mockExtractor = jest
        .fn()
        .mockRejectedValue(new Error('ONNX inference failed'));
      mockPipelineFn.mockResolvedValue(mockExtractor);

      // Act
      const result = await service.generateEmbedding(
        'Academic research project',
      );

      // Assert
      expect(result).toHaveLength(384);
      expect(mockExtractor).toHaveBeenCalled();
      const normSq = result.reduce((sum, val) => sum + val * val, 0);
      expect(Math.sqrt(normSq)).toBeCloseTo(1, 1);
    });

    // [OMA-W006-T002] Test local in-process embedding service with 384 dimensions
    it('should fall back to mock embedding if pipeline returns unexpected vector dimension', async () => {
      // Arrange
      const invalidVector = new Float32Array(512).fill(0.1);
      const mockExtractor = jest
        .fn()
        .mockResolvedValue({ data: invalidVector });
      mockPipelineFn.mockResolvedValue(mockExtractor);

      // Act
      const result = await service.generateEmbedding('Statement of purpose');

      // Assert
      expect(result).toHaveLength(384);
      const normSq = result.reduce((sum, val) => sum + val * val, 0);
      expect(Math.sqrt(normSq)).toBeCloseTo(1, 1);
    });

    // [OMA-W006-T002] Test local in-process embedding service with 384 dimensions
    it('should fall back to deterministic mock embedding if pipeline fails to initialize', async () => {
      // Arrange
      mockPipelineFn.mockRejectedValue(new Error('Failed to load WASM binary'));

      // Act
      const result = await service.generateEmbedding(
        'Extracurricular leadership',
      );

      // Assert
      expect(result).toHaveLength(384);
      const normSq = result.reduce((sum, val) => sum + val * val, 0);
      expect(Math.sqrt(normSq)).toBeCloseTo(1, 1);
    });
  });
});
