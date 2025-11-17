/**
 * AI SDK LLM Provider - Unified interface for multiple LLM providers
 */

import { generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';
import { LLMProvider, Message, Tool, LLMChunk } from '../../types';

export class AISDKLLMProvider implements LLMProvider {
  private provider: any;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private tools: Map<string, Tool> = new Map();
  private abortController: AbortController | null = null;

  constructor(config: {
    provider: 'openai' | 'anthropic' | 'google' | 'groq';
    apiKey: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    this.model = config.model;
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 150;

    // Initialize the appropriate provider
    switch (config.provider) {
      case 'openai':
        this.provider = openai;
        break;
      case 'anthropic':
        this.provider = anthropic;
        break;
      case 'google':
        this.provider = google;
        break;
      case 'groq':
        this.provider = groq;
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }

  addTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  async generate(options: {
    messages: Message[];
    stream?: boolean;
    tools?: Tool[];
  }): Promise<AsyncIterable<LLMChunk> | string> {
    const model = this.provider(this.model);

    // Convert messages to AI SDK format
    const formattedMessages = this.formatMessages(options.messages);

    // Prepare tools for AI SDK
    const toolDefinitions = this.formatTools(options.tools || Array.from(this.tools.values()));

    this.abortController = new AbortController();

    if (options.stream) {
      return this.streamGenerate(model, formattedMessages, toolDefinitions);
    } else {
      const result = await generateText({
        model,
        messages: formattedMessages,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        tools: toolDefinitions,
        abortSignal: this.abortController.signal,
      });

      return result.text;
    }
  }

  private async *streamGenerate(
    model: any,
    messages: any[],
    tools: any
  ): AsyncIterable<LLMChunk> {
    try {
      const result = await streamText({
        model,
        messages,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        tools,
        abortSignal: this.abortController?.signal,
      });

      // Stream text deltas
      for await (const delta of result.textStream) {
        yield {
          type: 'text',
          content: delta,
        };
      }

      // Handle tool calls if any
      const finalResult: any = await result.response;
      if (finalResult.toolCalls && finalResult.toolCalls.length > 0) {
        for (const toolCall of finalResult.toolCalls) {
          yield {
            type: 'tool-call',
            tool_call: {
              id: toolCall.toolCallId,
              name: toolCall.toolName,
              parameters: toolCall.args,
            },
          };
        }
      }

      yield { type: 'text', content: '', done: true };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[LLM] Generation aborted');
      } else {
        console.error('[LLM] Generation error:', error);
        throw error;
      }
    }
  }

  private formatMessages(messages: Message[]): any[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  private formatTools(tools: Tool[]): any {
    if (tools.length === 0) return undefined;

    const formattedTools: any = {};

    for (const tool of tools) {
      formattedTools[tool.name] = {
        description: tool.description,
        parameters: tool.parameters,
      };
    }

    return formattedTools;
  }

  async stop(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.tools.clear();
  }
}

// Export convenience creators for each provider
export function createOpenAIProvider(config: {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): AISDKLLMProvider {
  return new AISDKLLMProvider({
    provider: 'openai',
    apiKey: config.apiKey,
    model: config.model || 'gpt-4o-mini',
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
}

export function createAnthropicProvider(config: {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): AISDKLLMProvider {
  return new AISDKLLMProvider({
    provider: 'anthropic',
    apiKey: config.apiKey,
    model: config.model || 'claude-3-5-sonnet-20241022',
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
}

export function createGoogleProvider(config: {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): AISDKLLMProvider {
  return new AISDKLLMProvider({
    provider: 'google',
    apiKey: config.apiKey,
    model: config.model || 'gemini-2.0-flash-exp',
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
}

export function createGroqProvider(config: {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): AISDKLLMProvider {
  return new AISDKLLMProvider({
    provider: 'groq',
    apiKey: config.apiKey,
    model: config.model || 'llama-3.1-70b-versatile',
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
}
