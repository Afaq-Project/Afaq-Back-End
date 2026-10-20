// [OMA-W002-T006] AiProvider Interface

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiProvider {
  readonly providerName: string;
  generateText(systemPrompt: string, userPrompt: string): Promise<string>;
  chat(messages: AiChatMessage[]): Promise<string>;
}
