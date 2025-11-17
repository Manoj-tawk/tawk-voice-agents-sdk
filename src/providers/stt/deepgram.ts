/**
 * Deepgram STT Provider
 */

import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { STTProvider } from '../../types';
import { EventEmitter } from 'events';

export class DeepgramSTTProvider extends EventEmitter implements STTProvider {
  private client: any;
  private liveConnection: any | null = null;
  private apiKey: string;
  private model: string;
  private language: string;
  private interimResults: boolean;

  constructor(config: {
    apiKey: string;
    model?: string;
    language?: string;
    interimResults?: boolean;
  }) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model || 'nova-2';
    this.language = config.language || 'en-US';
    this.interimResults = config.interimResults ?? false;

    this.client = createClient(this.apiKey);
  }

  async transcribe(audio: Buffer): Promise<string> {
    try {
      const { result, error } = await this.client.listen.prerecorded.transcribeFile(audio, {
        model: this.model,
        language: this.language,
        smart_format: true,
        punctuate: true,
      });

      if (error) {
        throw error;
      }

      const transcript = result?.results?.channels[0]?.alternatives[0]?.transcript || '';
      return transcript;
    } catch (error) {
      console.error('[Deepgram] Transcription error:', error);
      throw error;
    }
  }

  async *transcribeStream(audioStream: AsyncIterable<Buffer>): AsyncIterable<string> {
    // Create live transcription connection
    this.liveConnection = this.client.listen.live({
      model: this.model,
      language: this.language,
      smart_format: true,
      punctuate: true,
      interim_results: this.interimResults,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
    });

    // Setup event handlers
    const transcripts: string[] = [];
    let resolveNext: ((value: string) => void) | null = null;
    let rejectNext: ((error: Error) => void) | null = null;
    let connectionClosed = false;

    this.liveConnection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const transcript = data.channel?.alternatives[0]?.transcript;
      if (transcript && data.is_final) {
        if (resolveNext) {
          resolveNext(transcript);
          resolveNext = null;
        } else {
          transcripts.push(transcript);
        }
      }
    });

    this.liveConnection.on(LiveTranscriptionEvents.Error, (error: Error) => {
      if (rejectNext) {
        rejectNext(error);
        rejectNext = null;
      }
    });

    this.liveConnection.on(LiveTranscriptionEvents.Close, () => {
      connectionClosed = true;
    });

    // Send audio data
    (async () => {
      try {
        for await (const chunk of audioStream) {
          if (this.liveConnection) {
            this.liveConnection.send(chunk);
          }
        }
        if (this.liveConnection) {
          this.liveConnection.finish();
        }
      } catch (error) {
        console.error('[Deepgram] Error streaming audio:', error);
      }
    })();

    // Yield transcripts as they arrive
    while (!connectionClosed) {
      if (transcripts.length > 0) {
        yield transcripts.shift()!;
      } else {
        try {
          const transcript = await Promise.race([
            new Promise<string>((resolve, reject) => {
              resolveNext = resolve;
              rejectNext = reject;
            }),
            new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 5000)
            ),
          ]);
          yield transcript;
        } catch (error) {
          if (connectionClosed) break;
        }
      }
    }
  }

  async stop(): Promise<void> {
    if (this.liveConnection) {
      this.liveConnection.finish();
      this.liveConnection = null;
    }
  }
}

