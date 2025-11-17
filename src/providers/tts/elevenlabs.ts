/**
 * ElevenLabs TTS Provider
 */

import { TTSProvider } from '../../types';
import axios from 'axios';

export class ElevenLabsTTSProvider implements TTSProvider {
  private apiKey: string;
  private voiceId: string;
  private model: string;
  private stability: number;
  private similarityBoost: number;

  constructor(config: {
    apiKey: string;
    voiceId: string;
    model?: string;
    stability?: number;
    similarityBoost?: number;
  }) {
    this.apiKey = config.apiKey;
    this.voiceId = config.voiceId;
    this.model = config.model || 'eleven_turbo_v2_5';
    this.stability = config.stability ?? 0.5;
    this.similarityBoost = config.similarityBoost ?? 0.75;
  }

  async *synthesize(text: string): AsyncIterable<Buffer> {
    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream`,
        {
          text,
          model_id: this.model,
          voice_settings: {
            stability: this.stability,
            similarity_boost: this.similarityBoost,
          },
        },
        {
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          responseType: 'stream',
        }
      );

      for await (const chunk of response.data) {
        yield Buffer.from(chunk);
      }
    } catch (error) {
      console.error('[ElevenLabs] TTS error:', error);
      throw error;
    }
  }

  async *synthesizeStream(textStream: AsyncIterable<string>): AsyncIterable<Buffer> {
    for await (const text of textStream) {
      if (text && text.trim().length > 0) {
        yield* this.synthesize(text);
      }
    }
  }

  async stop(): Promise<void> {
    // Cleanup
  }
}

