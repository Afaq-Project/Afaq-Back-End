// [OMA-W006-T001] Test Gemini environment configuration and provider initialization
// [OMA-W006-T003] Test Gemini provider with dynamic model and tool calling
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider';

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let mockConfigService: { get: jest.Mock };
  const originalFetch = global.fetch;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'GEMINI_API_KEY') {
          return 'test-valid-gemini-key-12345';
        }
        if (key === 'GEMINI_MODEL') {
          return 'gemini-1.5-pro';
        }
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiProvider,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    provider = module.get<GeminiProvider>(GeminiProvider);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('should be defined with providerName "gemini"', () => {
    expect(provider).toBeDefined();
    expect(provider.providerName).toBe('gemini');
  });

  // [OMA-W006-T001] Test Gemini environment configuration and provider initialization
  describe('initialization and model configuration', () => {
    it('should initialize with configured model from ConfigService', () => {
      expect(provider).toBeDefined();
      expect(mockConfigService.get).toHaveBeenCalledWith('GEMINI_API_KEY');
      expect(mockConfigService.get).toHaveBeenCalledWith('GEMINI_MODEL');
    });

    it('should fall back to default model gemini-3.5-flash-lite if GEMINI_MODEL is absent', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'GEMINI_API_KEY') {
          return 'valid-api-key-999';
        }
        return undefined;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GeminiProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const instance = module.get<GeminiProvider>(GeminiProvider);
      expect(instance).toBeDefined();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              { content: { parts: [{ text: 'Response from default model' }] } },
            ],
          }),
      });

      const res = await instance.generateText('System prompt', 'User prompt');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('models/gemini-3.5-flash-lite:generateContent'),
        expect.any(Object),
      );
      expect(res).toBe('Response from default model');
    });

    it('should fall back to mock generation when GEMINI_API_KEY is empty or mock', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'GEMINI_API_KEY') {
          return 'mock';
        }
        return undefined;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GeminiProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const instance = module.get<GeminiProvider>(GeminiProvider);
      global.fetch = jest.fn();

      const res = await instance.chatWithTools([
        { role: 'user', content: 'Help me draft an essay' },
      ]);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(res.reply).toContain('[AI Copilot]');
      expect(res.toolCalls).toEqual([]);
    });
  });

  // [OMA-W006-T003] Test Gemini provider with dynamic model and tool calling
  describe('chatWithTools and response parsing', () => {
    it('should parse text completion response correctly', async () => {
      const mockApiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Here is your polished scholarship personal statement.',
                },
              ],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const messages = [
        { role: 'system' as const, content: 'You are an academic advisor.' },
        { role: 'user' as const, content: 'Review my draft introduction.' },
      ];

      const result = await provider.chatWithTools(messages, true);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          'models/gemini-1.5-pro:generateContent?key=test-valid-gemini-key-12345',
        ),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('propose_document_edit'),
        }),
      );
      expect(result.reply).toBe(
        'Here is your polished scholarship personal statement.',
      );
      expect(result.toolCalls).toEqual([]);
    });

    it('should parse tool calling responses for propose_document_edit', async () => {
      const mockApiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'I noticed an opportunity for improvement in your draft.',
                },
                {
                  functionCall: {
                    name: 'propose_document_edit',
                    args: {
                      pageId: 'page-uuid-1',
                      originalText: 'I want to study machine learning.',
                      suggestedText:
                        'I aspire to specialize in statistical machine learning and neural architectures.',
                      explanation:
                        'Elevates rhetorical sophistication and academic precision.',
                    },
                  },
                },
              ],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const messages = [
        {
          role: 'user' as const,
          content: 'Improve this sentence: I want to study machine learning.',
        },
      ];

      const result = await provider.chatWithTools(messages, true);

      expect(result.reply).toBe(
        'I noticed an opportunity for improvement in your draft.',
      );
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]).toEqual({
        name: 'propose_document_edit',
        args: {
          pageId: 'page-uuid-1',
          originalText: 'I want to study machine learning.',
          suggestedText:
            'I aspire to specialize in statistical machine learning and neural architectures.',
          explanation:
            'Elevates rhetorical sophistication and academic precision.',
        },
      });
    });

    it('should handle API HTTP errors by falling back gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Resource has been exhausted (rate limit)'),
      });

      const messages = [
        { role: 'system' as const, content: 'academic instructions' },
        { role: 'user' as const, content: 'Draft scholarship conclusion' },
      ];

      const result = await provider.chatWithTools(messages);

      expect(result.reply).toContain('academic specialization');
      expect(result.toolCalls).toEqual([]);
    });

    it('should handle request network exceptions / timeout abort by falling back gracefully', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(
          new Error('The operation was aborted due to timeout'),
        );

      const messages = [
        { role: 'system' as const, content: 'grammar check' },
        { role: 'user' as const, content: 'She goes to school yesterday' },
      ];

      const result = await provider.chatWithTools(messages);

      expect(result.reply).toBe('She goes to school yesterday');
      expect(result.toolCalls).toEqual([]);
    });

    it('should provide function declarations schema for propose_document_edit', () => {
      const declarations = provider.getFunctionDeclarations();
      expect(declarations).toBeDefined();
      expect(declarations[0].functionDeclarations[0].name).toBe(
        'propose_document_edit',
      );
      expect(
        declarations[0].functionDeclarations[0].parameters.required,
      ).toEqual(['pageId', 'originalText', 'suggestedText']);
    });

    it('generateText should call chatWithTools with includeTools=false and return text reply', async () => {
      const spy = jest.spyOn(provider, 'chatWithTools').mockResolvedValue({
        reply: 'Generated text response',
        toolCalls: [],
      });

      const reply = await provider.generateText('System prompt', 'User prompt');

      expect(spy).toHaveBeenCalledWith(
        [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'User prompt' },
        ],
        false,
      );
      expect(reply).toBe('Generated text response');
    });

    it('chat should call chatWithTools with includeTools=true and return reply', async () => {
      const spy = jest.spyOn(provider, 'chatWithTools').mockResolvedValue({
        reply: 'Chat response with tools',
        toolCalls: [],
      });

      const reply = await provider.chat([
        { role: 'user', content: 'Hello AI' },
      ]);

      expect(spy).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Hello AI' }],
        true,
      );
      expect(reply).toBe('Chat response with tools');
    });
  });
});
