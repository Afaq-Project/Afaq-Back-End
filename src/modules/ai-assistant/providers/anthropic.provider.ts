// [OMA-W002-T006] AnthropicProvider
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, AiChatMessage } from './ai-provider.interface';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AnthropicProvider implements AiProvider {
  readonly providerName = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);
  private client: Anthropic | null = null;
  private model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('ANTHROPIC_API_KEY') ||
      process.env.ANTHROPIC_API_KEY;

    this.model =
      this.configService.get<string>('ANTHROPIC_MODEL') ||
      process.env.ANTHROPIC_MODEL ||
      'claude-3-5-sonnet-20241022';

    if (apiKey && apiKey !== 'mock' && apiKey.length > 5) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured. Fallback mode enabled.',
      );
    }
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    if (!this.client) {
      return `[Claude Analysis]: ${userPrompt}`;
    }

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const block = response.content[0];
      return block?.type === 'text' ? block.text.trim() : '';
    } catch (error) {
      this.logger.error(`Anthropic API error: ${(error as Error).message}`);
      return `[Claude Fallback]: ${userPrompt}`;
    }
  }

  async chat(messages: AiChatMessage[]): Promise<string> {
    if (!this.client) {
      const last = messages[messages.length - 1];
      return `[Claude Assistant] Assisting with your query: "${last?.content}"`;
    }

    try {
      const systemMsg =
        messages.find((m) => m.role === 'system')?.content || '';
      const chatMessages = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemMsg,
        messages: chatMessages,
      });

      const block = response.content[0];
      return block?.type === 'text' ? block.text.trim() : '';
    } catch (error) {
      this.logger.error(`Anthropic chat error: ${(error as Error).message}`);
      const last = messages[messages.length - 1];
      return `[Claude Assistant] Regarding: ${last?.content}`;
    }
  }
}
