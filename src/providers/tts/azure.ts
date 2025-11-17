/**
 * Azure Neural TTS Provider
 */

import { TTSProvider } from '../../types';
import axios from 'axios';

export class AzureTTSProvider implements TTSProvider {
  private subscriptionKey: string;
  private region: string;
  private voice: string;

  constructor(config: { subscriptionKey: string; region: string; voice?: string }) {
    this.subscriptionKey = config.subscriptionKey;
    this.region = config.region;
    this.voice = config.voice || 'en-US-JennyNeural';
  }

  async *synthesize(text: string): AsyncIterable<Buffer> {
    try {
      const ssml = `
        <speak version='1.0' xml:lang='en-US'>
          <voice name='${this.voice}'>
            ${text}
          </voice>
        </speak>
      `;

      const response = await axios.post(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        ssml,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.subscriptionKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm',
          },
          responseType: 'arraybuffer',
        }
      );

      yield Buffer.from(response.data);
    } catch (error) {
      console.error('[Azure TTS] Synthesis error:', error);
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

