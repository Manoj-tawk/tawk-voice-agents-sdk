/**
 * OpenAI TTS Provider
 */

import { TTSProvider } from '../../types';
import { OpenAI } from 'openai';

export class OpenAITTSProvider implements TTSProvider {
  private client: OpenAI;
  private voice: string;
  private model: string;

  constructor(config: { apiKey: string; voice?: string; model?: string }) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.voice = config.voice || 'alloy';
    this.model = config.model || 'tts-1';
  }

  async *synthesize(text: string): AsyncIterable<Buffer> {
    try {
      const mp3 = await this.client.audio.speech.create({
        model: this.model,
        voice: this.voice as any,
        input: text,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      yield buffer;
    } catch (error) {
      console.error('[OpenAI TTS] Synthesis error:', error);
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

