/**
 * AssemblyAI STT Provider
 */

import { STTProvider } from '../../types';
import axios from 'axios';

export class AssemblyAISTTProvider implements STTProvider {
  private apiKey: string;
  private websocket: any | null = null;

  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }

  async transcribe(audio: Buffer): Promise<string> {
    try {
      // Upload audio file
      const uploadResponse = await axios.post(
        'https://api.assemblyai.com/v2/upload',
        audio,
        {
          headers: {
            authorization: this.apiKey,
            'content-type': 'application/octet-stream',
          },
        }
      );

      const audioUrl = uploadResponse.data.upload_url;

      // Start transcription
      const transcriptResponse = await axios.post(
        'https://api.assemblyai.com/v2/transcript',
        {
          audio_url: audioUrl,
          language_detection: true,
          punctuate: true,
          format_text: true,
        },
        {
          headers: {
            authorization: this.apiKey,
            'content-type': 'application/json',
          },
        }
      );

      const transcriptId = transcriptResponse.data.id;

      // Poll for completion
      while (true) {
        const statusResponse = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          {
            headers: {
              authorization: this.apiKey,
            },
          }
        );

        if (statusResponse.data.status === 'completed') {
          return statusResponse.data.text || '';
        } else if (statusResponse.data.status === 'error') {
          throw new Error(`AssemblyAI transcription error: ${statusResponse.data.error}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('[AssemblyAI] Transcription error:', error);
      throw error;
    }
  }

  async *transcribeStream(audioStream: AsyncIterable<Buffer>): AsyncIterable<string> {
    // AssemblyAI real-time transcription requires WebSocket
    const WebSocket = require('ws');

    // Get temporary token
    const tokenResponse = await axios.post(
      'https://api.assemblyai.com/v2/realtime/token',
      { expires_in: 3600 },
      {
        headers: {
          authorization: this.apiKey,
        },
      }
    );

    const token = tokenResponse.data.token;

    this.websocket = new WebSocket(
      `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
    );

    const transcripts: string[] = [];
    let resolveNext: ((value: string) => void) | null = null;
    let connectionClosed = false;

    await new Promise((resolve, reject) => {
      this.websocket!.once('open', resolve);
      this.websocket!.once('error', reject);
    });

    this.websocket.on('message', (data: any) => {
      const message = JSON.parse(data);

      if (message.message_type === 'FinalTranscript') {
        const transcript = message.text;
        if (transcript) {
          if (resolveNext) {
            resolveNext(transcript);
            resolveNext = null;
          } else {
            transcripts.push(transcript);
          }
        }
      }
    });

    this.websocket.on('close', () => {
      connectionClosed = true;
    });

    // Send audio data
    (async () => {
      try {
        for await (const chunk of audioStream) {
          if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            const base64Audio = chunk.toString('base64');
            this.websocket.send(JSON.stringify({ audio_data: base64Audio }));
          }
        }
      } catch (error) {
        console.error('[AssemblyAI] Error streaming audio:', error);
      }
    })();

    // Yield transcripts as they arrive
    while (!connectionClosed) {
      if (transcripts.length > 0) {
        yield transcripts.shift()!;
      } else {
        try {
          const transcript = await Promise.race([
            new Promise<string>((resolve) => {
              resolveNext = resolve;
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
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }
}

