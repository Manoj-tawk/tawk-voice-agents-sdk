/**
 * Deepgram Aura TTS Provider
 */

import { TTSProvider } from '../../types';
import axios from 'axios';

export class DeepgramTTSProvider implements TTSProvider {
  private apiKey: string;
  private voice: string;
  private model: string;

  constructor(config: { apiKey: string; voice?: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.voice = config.voice || 'aura-asteria-en';
    this.model = config.model || 'aura-2';
  }

  async *synthesize(text: string): AsyncIterable<Buffer> {
    try {
      const response = await axios.post(
        'https://api.deepgram.com/v1/speak',
        { text },
        {
          headers: {
            Authorization: `Token ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            model: this.voice,
            encoding: 'linear16',
            sample_rate: 16000,
          },
          responseType: 'stream',
        }
      );

      for await (const chunk of response.data) {
        yield Buffer.from(chunk);
      }
    } catch (error) {
      console.error('[Deepgram TTS] Synthesis error:', error);
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

