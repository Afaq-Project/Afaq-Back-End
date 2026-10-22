// [OMA-W006-T004] Conversational memory RAG service and profile grounding
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LocalEmbeddingService } from './local-embedding.service';

export interface RelevantTurn {
  messageId: string;
  role: string;
  content: string;
  similarity: number;
}

interface RawTurnRow {
  messageId: string;
  role: string;
  content: string;
  similarity: number | string;
}

@Injectable()
export class AiMemoryService {
  private readonly logger = new Logger(AiMemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly localEmbeddingService: LocalEmbeddingService,
  ) {}

  async indexTurn(
    messageId: string,
    conversationId: string,
    userId: string,
    content: string,
  ): Promise<void> {
    try {
      if (!content || content.trim().length === 0) {
        return;
      }

      const embedding =
        await this.localEmbeddingService.generateEmbedding(content);
      const vectorStr = `[${embedding.join(',')}]`;

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO ai_message_embeddings (id, message_id, conversation_id, user_id, embedding, created_at)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::vector, NOW())
         ON CONFLICT (message_id) DO NOTHING`,
        messageId,
        conversationId,
        userId,
        vectorStr,
      );
    } catch (err) {
      this.logger.error(
        `Failed to index turn for message ${messageId}: ${(err as Error).message}`,
      );
    }
  }

  async findRelevantTurns(
    conversationId: string,
    userId: string,
    query: string,
    topK = 5,
  ): Promise<RelevantTurn[]> {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const embedding =
        await this.localEmbeddingService.generateEmbedding(query);
      const vectorStr = `[${embedding.join(',')}]`;

      const sql = `
        SELECT m.id as "messageId", m.role, m.content, 1 - (e.embedding <=> $1::vector) AS similarity
        FROM ai_message_embeddings e
        JOIN ai_messages m ON m.id = e.message_id
        WHERE e.conversation_id = $2::uuid
          AND e.user_id = $3::uuid
          AND m.id NOT IN (
            SELECT id FROM ai_messages WHERE conversation_id = $2::uuid ORDER BY created_at DESC LIMIT 3
          )
        ORDER BY e.embedding <=> $1::vector ASC
        LIMIT $4
      `;

      const rows = await this.prisma.$queryRawUnsafe<RawTurnRow[]>(
        sql,
        vectorStr,
        conversationId,
        userId,
        topK,
      );

      return (rows || []).map((r) => ({
        messageId: r.messageId,
        role: r.role,
        content: r.content,
        similarity:
          typeof r.similarity === 'number'
            ? r.similarity
            : parseFloat(String(r.similarity)) || 0,
      }));
    } catch (err) {
      this.logger.warn(
        `Vector similarity search failed: ${(err as Error).message}. Returning empty context.`,
      );
      return [];
    }
  }

  async getUserContext(userId: string): Promise<string> {
    try {
      const profile = await this.prisma.userProfiles.findUnique({
        where: { userId },
        include: {
          educations: {
            include: {
              educationLevel: true,
              major: true,
              institution: true,
            },
          },
          languages: {
            include: {
              language: true,
              proficiencyLevel: true,
            },
          },
        },
      });

      if (!profile) {
        return '';
      }

      const parts: string[] = [];

      const fullName = [profile.firstName, profile.lastName]
        .filter(Boolean)
        .join(' ');
      if (fullName) {
        parts.push(`Candidate Name: ${fullName}`);
      }

      if (profile.bio) {
        parts.push(`Bio: ${profile.bio}`);
      }

      if (profile.experiences && profile.experiences.length > 0) {
        parts.push(`Experiences: ${profile.experiences.join('; ')}`);
      }

      if (profile.educations && profile.educations.length > 0) {
        const eduDetails = profile.educations.map((edu) => {
          const level = edu.educationLevel?.nameEn || 'Degree';
          const major = edu.major?.nameEn || 'Major';
          const institution = edu.institution?.nameEn || 'Institution';
          const gpa = edu.gpaNormalized ?? edu.gpaRaw;
          const gpaStr = gpa ? ` (GPA: ${String(gpa)})` : '';
          return `${level} in ${major} from ${institution}${gpaStr}`;
        });
        parts.push(`Education: ${eduDetails.join('; ')}`);
      }

      if (profile.languages && profile.languages.length > 0) {
        const langDetails = profile.languages.map((lang) => {
          const name = lang.language?.nameEn || 'Language';
          const proficiency =
            lang.proficiencyLevel?.nameEn ||
            (lang.isNative ? 'Native' : 'Proficient');
          return `${name} (${proficiency})`;
        });
        parts.push(`Languages: ${langDetails.join('; ')}`);
      }

      return parts.join('\n');
    } catch (err) {
      this.logger.warn(
        `Failed to retrieve user profile context for user ${userId}: ${(err as Error).message}`,
      );
      return '';
    }
  }
}
