/**
 * Cartesia TTS Provider
 */

import { TTSProvider } from '../../types';
import axios from 'axios';

export class CartesiaTTSProvider implements TTSProvider {
  private apiKey: string;
  private voiceId: string;
  private model: string;
  private websocket: any = null;

  constructor(config: { apiKey: string; voiceId?: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.voiceId = config.voiceId || 'a0e99841-438c-4a64-b679-ae501e7d6091'; // Default Cartesia voice
    this.model = config.model || 'sonic-english';
  }

  async *synthesize(text: string): AsyncIterable<Buffer> {
    try {
      const response = await axios.post(
        'https://api.cartesia.ai/tts/bytes',
        {
          model_id: this.model,
          transcript: text,
          voice: {
            mode: 'id',
            id: this.voiceId,
          },
          output_format: {
            container: 'raw',
            encoding: 'pcm_s16le',
            sample_rate: 16000,
          },
        },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Cartesia-Version': '2024-06-10',
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );

      yield Buffer.from(response.data);
    } catch (error) {
      console.error('[Cartesia] TTS error:', error);
      throw error;
    }
  }

  async *synthesizeStream(textStream: AsyncIterable<string>): AsyncIterable<Buffer> {
    // Cartesia supports WebSocket streaming
    const WebSocket = require('ws');

    this.websocket = new WebSocket('wss://api.cartesia.ai/tts/websocket', {
      headers: {
        'X-API-Key': this.apiKey,
        'Cartesia-Version': '2024-06-10',
      },
    });

    await new Promise((resolve, reject) => {
      this.websocket.once('open', resolve);
      this.websocket.once('error', reject);
    });

    const audioChunks: Buffer[] = [];
    let resolveNext: ((value: Buffer) => void) | null = null;
    let connectionClosed = false;

    this.websocket.on('message', (data: any) => {
      try {
        const message = JSON.parse(data);

        if (message.type === 'chunk' && message.data) {
          const audioData = Buffer.from(message.data, 'base64');
          if (resolveNext) {
            resolveNext(audioData);
            resolveNext = null;
          } else {
            audioChunks.push(audioData);
          }
        } else if (message.type === 'done') {
          connectionClosed = true;
        }
      } catch (error) {
        console.error('[Cartesia] Error parsing message:', error);
      }
    });

    this.websocket.on('close', () => {
      connectionClosed = true;
    });

    // Send text chunks for synthesis
    (async () => {
      try {
        for await (const text of textStream) {
          if (text && text.trim().length > 0 && this.websocket) {
            this.websocket.send(
              JSON.stringify({
                model_id: this.model,
                transcript: text,
                voice: {
                  mode: 'id',
                  id: this.voiceId,
                },
                output_format: {
                  container: 'raw',
                  encoding: 'pcm_s16le',
                  sample_rate: 16000,
                },
                context_id: 'stream-context',
              })
            );
          }
        }

        // Signal end of stream
        if (this.websocket) {
          this.websocket.send(
            JSON.stringify({
              context_id: 'stream-context',
              continue: false,
            })
          );
        }
      } catch (error) {
        console.error('[Cartesia] Error sending text:', error);
      }
    })();

    // Yield audio chunks as they arrive
    while (!connectionClosed) {
      if (audioChunks.length > 0) {
        yield audioChunks.shift()!;
      } else {
        try {
          const chunk = await Promise.race([
            new Promise<Buffer>((resolve) => {
              resolveNext = resolve;
            }),
            new Promise<Buffer>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 5000)
            ),
          ]);
          yield chunk;
        } catch (error) {
          if (connectionClosed) break;
        }
      }
    }
  }

  async stop(): Promise<void> {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }
}

