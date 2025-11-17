/**
 * TTS Provider Factory
 */

import { TTSProvider, TTSConfig } from '../../types';
import { ElevenLabsTTSProvider } from './elevenlabs';
import { CartesiaTTSProvider } from './cartesia';
import { OpenAITTSProvider } from './openai';
import { DeepgramTTSProvider } from './deepgram';
import { AzureTTSProvider } from './azure';

export function createTTSProvider(config: TTSConfig): TTSProvider {
  switch (config.provider) {
    case 'elevenlabs':
      if (!config.voiceId) {
        throw new Error('ElevenLabs requires voiceId in config');
      }
      return new ElevenLabsTTSProvider({
        apiKey: config.apiKey,
        voiceId: config.voiceId,
        model: config.model,
        ...config.config,
      });

    case 'cartesia':
      return new CartesiaTTSProvider({
        apiKey: config.apiKey,
        voiceId: config.voiceId,
        model: config.model,
      });

    case 'openai':
      return new OpenAITTSProvider({
        apiKey: config.apiKey,
        voice: config.voiceId,
        model: config.model,
      });

    case 'deepgram':
      return new DeepgramTTSProvider({
        apiKey: config.apiKey,
        voice: config.voiceId,
        model: config.model,
      });

    case 'azure':
      const azureConfig = config.config;
      if (!azureConfig?.region) {
        throw new Error('Azure TTS requires region in config.config');
      }
      return new AzureTTSProvider({
        subscriptionKey: config.apiKey,
        region: azureConfig.region,
        voice: config.voiceId,
      });

    case 'google':
      throw new Error('Google TTS provider not yet implemented');

    default:
      throw new Error(`Unknown TTS provider: ${config.provider}`);
  }
}

export * from './elevenlabs';
export * from './cartesia';
export * from './openai';
export * from './deepgram';
export * from './azure';

