// [OMA-W006-T003] Native Google Gemini provider with dynamic model and tool calling
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, AiChatMessage } from './ai-provider.interface';

export interface GeminiToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiChatResponse {
  reply: string;
  toolCalls: GeminiToolCall[];
}

interface GeminiRequestBody {
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  tools?: unknown[];
}

interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
    role?: string;
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

@Injectable()
export class GeminiProvider implements AiProvider {
  readonly providerName = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private apiKey: string;
  private model: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      process.env.GEMINI_API_KEY ||
      '';

    this.model =
      this.configService.get<string>('GEMINI_MODEL') ||
      process.env.GEMINI_MODEL ||
      'gemini-3.5-flash-lite';

    if (!this.apiKey || this.apiKey === 'mock' || this.apiKey.length < 5) {
      this.logger.warn(
        'GEMINI_API_KEY not configured or set to mock. Fallback generation enabled.',
      );
    }
  }

  getFunctionDeclarations() {
    return [
      {
        functionDeclarations: [
          {
            name: 'propose_document_edit',
            description:
              'Propose a specific text edit to a draft document page. Emits a staged reviewable proposal.',
            parameters: {
              type: 'OBJECT',
              properties: {
                pageId: {
                  type: 'STRING',
                  description: 'The UUID of the draft page',
                },
                originalText: {
                  type: 'STRING',
                  description: 'Exact text substring to replace',
                },
                suggestedText: {
                  type: 'STRING',
                  description: 'New replacement text',
                },
                explanation: {
                  type: 'STRING',
                  description: 'Reasoning for the edit',
                },
              },
              required: ['pageId', 'originalText', 'suggestedText'],
            },
          },
        ],
      },
    ];
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const messages: AiChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    const res = await this.chatWithTools(messages, false);
    return res.reply;
  }

  async chat(messages: AiChatMessage[]): Promise<string> {
    const res = await this.chatWithTools(messages, true);
    return res.reply;
  }

  async chatWithTools(
    messages: AiChatMessage[],
    includeTools = true,
  ): Promise<GeminiChatResponse> {
    if (!this.apiKey || this.apiKey === 'mock' || this.apiKey.length < 5) {
      return this.fallbackResponse(messages);
    }

    const systemParts: string[] = [];
    const contents: Array<{
      role: 'user' | 'model';
      parts: Array<{ text: string }>;
    }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello' }],
      });
    }

    const payload: GeminiRequestBody = {
      contents,
    };

    if (systemParts.length > 0) {
      payload.systemInstruction = {
        parts: [{ text: systemParts.join('\n\n') }],
      };
    }

    if (includeTools) {
      payload.tools = this.getFunctionDeclarations();
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.error(
          `Gemini API returned status ${response.status}: ${errorText}`,
        );
        return this.fallbackResponse(messages);
      }

      const data = (await response.json()) as GeminiResponse;
      return this.parseGeminiResponse(data, messages);
    } catch (err) {
      this.logger.error(
        `Gemini request failed: ${(err as Error).message}. Falling back.`,
      );
      return this.fallbackResponse(messages);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseGeminiResponse(
    data: GeminiResponse,
    messages: AiChatMessage[],
  ): GeminiChatResponse {
    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts) {
      return this.fallbackResponse(messages);
    }

    let reply = '';
    const toolCalls: GeminiToolCall[] = [];

    for (const part of candidate.content.parts) {
      if (part.text) {
        reply += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        });
      }
    }

    return {
      reply: reply.trim(),
      toolCalls,
    };
  }

  private fallbackResponse(messages: AiChatMessage[]): GeminiChatResponse {
    const last = messages[messages.length - 1];
    const text = last?.content || '';

    const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
    if (systemMsg.includes('academic')) {
      return {
        reply: `I am earnestly endeavoring to pursue this academic specialization, as it presents transformative potential for advancing my scholarly and professional trajectory.`,
        toolCalls: [],
      };
    }
    if (systemMsg.includes('grammar')) {
      return {
        reply: text.trim(),
        toolCalls: [],
      };
    }
    if (systemMsg.includes('shorten')) {
      return {
        reply: text.length > 50 ? `${text.slice(0, 50).trim()}...` : text,
        toolCalls: [],
      };
    }
    if (systemMsg.includes('expand')) {
      return {
        reply: `${text} Furthermore, this initiative demonstrates significant commitment to academic excellence and community impact.`,
        toolCalls: [],
      };
    }

    return {
      reply: `[AI Copilot] Regarding "${text.slice(0, 100)}": I am here to assist you in refining your scholarship application materials.`,
      toolCalls: [],
    };
  }
}
