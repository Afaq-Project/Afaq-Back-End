// [OMA-W002-T006] OpenAiProvider
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, AiChatMessage } from './ai-provider.interface';
import OpenAI from 'openai';

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly providerName = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);
  private client: OpenAI | null = null;
  private model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('OPENAI_API_KEY') ||
      process.env.OPENAI_API_KEY;

    this.model =
      this.configService.get<string>('OPENAI_MODEL') ||
      process.env.OPENAI_MODEL ||
      'gpt-4o-mini';

    if (apiKey && apiKey !== 'mock' && apiKey.length > 5) {
      this.client = new OpenAI({ apiKey });
    } else {
      this.logger.warn(
        'OPENAI_API_KEY not configured or set to mock. Fallback generation enabled.',
      );
    }
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    if (!this.client) {
      return this.fallbackTransform(userPrompt, systemPrompt);
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      this.logger.error(
        `OpenAI error: ${(error as Error).message}. Falling back.`,
      );
      return this.fallbackTransform(userPrompt, systemPrompt);
    }
  }

  async chat(messages: AiChatMessage[]): Promise<string> {
    if (!this.client) {
      const last = messages[messages.length - 1];
      return `[AI Assistant] I received your message: "${last?.content}". How else may I assist with your document?`;
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      this.logger.error(`OpenAI chat error: ${(error as Error).message}`);
      const last = messages[messages.length - 1];
      return `[AI Assistant] Regarding "${last?.content}": I am here to assist you in refining your scholarship application materials.`;
    }
  }

  private fallbackTransform(text: string, systemPrompt: string): string {
    if (
      systemPrompt.includes('academic_tone') ||
      systemPrompt.includes('academic')
    ) {
      return `I am earnestly endeavoring to pursue this academic specialization, as it presents transformative potential for advancing my scholarly and professional trajectory.`;
    }
    if (systemPrompt.includes('grammar')) {
      return text.trim();
    }
    if (systemPrompt.includes('shorten')) {
      return text.length > 50 ? `${text.slice(0, 50).trim()}...` : text;
    }
    if (systemPrompt.includes('expand')) {
      return `${text} Furthermore, this initiative demonstrates significant commitment to academic excellence and community impact.`;
    }
    return `[Polished]: ${text}`;
  }
}
