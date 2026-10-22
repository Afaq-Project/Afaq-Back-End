// [OMA-W010-T001] Refactor LocalEmbeddingService to use Gemini embedContent REST API with mock fallback
// [OMA-W010-T002] Remove @xenova/transformers and ONNX runtime dependencies in favor of Google Cloud embeddings
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GeminiEmbedResponse {
  embedding?: {
    values?: number[];
  };
}

@Injectable()
export class LocalEmbeddingService {
  private readonly logger = new Logger(LocalEmbeddingService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return this.generateMockEmbedding('empty');
    }

    const apiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      process.env.GEMINI_API_KEY ||
      '';
    const model =
      this.configService.get<string>('GEMINI_EMBEDDING_MODEL') ||
      process.env.GEMINI_EMBEDDING_MODEL ||
      'gemini-embedding-001';

    if (!apiKey || apiKey === 'mock' || apiKey.length < 5) {
      this.logger.warn(
        'GEMINI_API_KEY not configured or set to mock. Using mock embeddings.',
      );
      return this.generateMockEmbedding(text);
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: `models/${model}`,
            content: {
              parts: [{ text }],
            },
            outputDimensionality: 384,
          }),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.warn(
          `Gemini embedding API returned status ${response.status}: ${errorText}. Falling back to mock.`,
        );
        return this.generateMockEmbedding(text);
      }

      const data = (await response.json()) as GeminiEmbedResponse;
      if (data.embedding?.values && data.embedding.values.length === 384) {
        return data.embedding.values;
      }

      this.logger.warn(
        `Gemini embedding API returned invalid embedding dimensions. Falling back to mock.`,
      );
      return this.generateMockEmbedding(text);
    } catch (err) {
      this.logger.warn(
        `Error generating embedding with Gemini: ${(err as Error).message}. Falling back to mock.`,
      );
      return this.generateMockEmbedding(text);
    }
  }

  private generateMockEmbedding(text: string): number[] {
    const dim = 384;
    const embedding = new Array<number>(dim);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    let normSq = 0;
    for (let i = 0; i < dim; i++) {
      const pseudo = Math.sin(hash + (i + 1) * 31.7);
      embedding[i] = pseudo;
      normSq += pseudo * pseudo;
    }
    const norm = Math.sqrt(normSq) || 1;
    return embedding.map((val) => Number((val / norm).toFixed(6)));
  }
}
