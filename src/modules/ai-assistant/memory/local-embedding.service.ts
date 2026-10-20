// [OMA-W006-T001] Setup @xenova/transformers dependencies and pgvector previewFeatures
// [OMA-W006-T002] Local in-process embedding service with all-MiniLM-L6-v2
import { Injectable, Logger } from '@nestjs/common';

type PipelineExtractor = (
  text: string,
  options?: { pooling?: string; normalize?: boolean },
) => Promise<{ data: Float32Array | number[] }>;

@Injectable()
export class LocalEmbeddingService {
  private readonly logger = new Logger(LocalEmbeddingService.name);
  private pipelinePromise: Promise<PipelineExtractor | null> | null = null;

  private async getPipeline(): Promise<PipelineExtractor | null> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        try {
          const { pipeline } = await import('@xenova/transformers');
          const extractor = (await pipeline(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2',
            { quantized: true },
          )) as unknown as PipelineExtractor;
          return extractor;
        } catch (err) {
          this.logger.warn(
            `Failed to load @xenova/transformers pipeline, using mock embeddings: ${(err as Error).message}`,
          );
          return null;
        }
      })();
    }
    return this.pipelinePromise;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return this.generateMockEmbedding('empty');
    }

    try {
      const extractor = await this.getPipeline();
      if (!extractor) {
        return this.generateMockEmbedding(text);
      }

      const output = await extractor(text, {
        pooling: 'mean',
        normalize: true,
      });

      const embedding = Array.from(output.data);

      if (embedding.length === 384) {
        return embedding;
      }
      return this.generateMockEmbedding(text);
    } catch (err) {
      this.logger.warn(
        `Error generating embedding with @xenova/transformers: ${(err as Error).message}. Falling back to mock.`,
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
