/**
 * STT Provider Factory
 */

import { STTProvider, STTConfig } from '../../types';
import { DeepgramSTTProvider } from './deepgram';
import { AssemblyAISTTProvider } from './assemblyai';
import { OpenAIWhisperSTTProvider } from './openai';

export function createSTTProvider(config: STTConfig): STTProvider {
  switch (config.provider) {
    case 'deepgram':
      return new DeepgramSTTProvider({
        apiKey: config.apiKey,
        model: config.model,
        language: config.language,
        interimResults: config.interimResults,
      });

    case 'assemblyai':
      return new AssemblyAISTTProvider({
        apiKey: config.apiKey,
      });

    case 'openai':
      return new OpenAIWhisperSTTProvider({
        apiKey: config.apiKey,
        model: config.model,
      });

    case 'google':
      throw new Error('Google STT provider not yet implemented');

    case 'azure':
      throw new Error('Azure STT provider not yet implemented');

    default:
      throw new Error(`Unknown STT provider: ${config.provider}`);
  }
}

export * from './deepgram';
export * from './assemblyai';
export * from './openai';

