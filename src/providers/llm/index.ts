/**
 * LLM Provider Factory
 */

import { LLMProvider, LLMConfig } from '../../types';
import {
  AISDKLLMProvider,
  createOpenAIProvider,
  createAnthropicProvider,
  createGoogleProvider,
  createGroqProvider,
} from './ai-sdk';

export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return createOpenAIProvider({
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

    case 'anthropic':
      return createAnthropicProvider({
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

    case 'google':
      return createGoogleProvider({
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

    case 'groq':
      return createGroqProvider({
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

export * from './ai-sdk';
export { AISDKLLMProvider };

