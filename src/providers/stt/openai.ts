/**
 * OpenAI Realtime API STT Provider
 * 
 * Uses OpenAI Realtime API for TRUE streaming transcription
 * - Low latency
 * - Real-time streaming
 * - WebSocket-based
 */

import { STTProvider } from '../../types';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

export class OpenAIWhisperSTTProvider extends EventEmitter implements STTProvider {
  private apiKey: string;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  constructor(config: { apiKey: string; model?: string }) {
    super();
    this.apiKey = config.apiKey;
  }

  /**
   * Batch transcription - commits audio buffer and waits for complete transcription
   * 
   * SOLUTION: Use a FRESH WebSocket connection for each transcription to avoid mixing events
   * This eliminates cross-contamination between consecutive transcription calls
   */
  async transcribe(audio: Buffer): Promise<string> {
    let ws: WebSocket | null = null;
    
    try {
      // STEP 1: Create a FRESH WebSocket connection for THIS transcription only
      ws = await this.connectRealtimeAPI();

      // STEP 2: Send the audio
      const base64Audio = audio.toString('base64');
      ws.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64Audio,
      }));

      // STEP 3: Commit the audio buffer to trigger transcription
      ws.send(JSON.stringify({
        type: 'input_audio_buffer.commit',
      }));

      // STEP 4: Buffer ALL transcription events until complete
      const transcriptPromise = new Promise<string>((resolve, reject) => {
        const transcripts: string[] = [];
        let lastTranscriptTime = Date.now();
        let checkInterval: NodeJS.Timeout;
        
        const timeout = setTimeout(() => {
          clearInterval(checkInterval);
          ws?.removeAllListeners('message');
          
          // Return whatever we got (even if empty)
          const finalTranscript = transcripts.join(' ').trim();
          resolve(finalTranscript);
        }, 8000); // 8 second max timeout

        const handler = (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            
            // Collect transcription events
            if (message.type === 'conversation.item.input_audio_transcription.completed') {
              const transcript = message.transcript?.trim();
              if (transcript && transcript.length > 0) {
                transcripts.push(transcript);
                lastTranscriptTime = Date.now();
              }
            }
          } catch (error) {
            // Ignore parse errors
          }
        };

        // Check every 300ms if we've stopped receiving transcripts
        checkInterval = setInterval(() => {
          const timeSinceLastTranscript = Date.now() - lastTranscriptTime;
          
          // If 3 seconds have passed since last transcript, we're done
          if (timeSinceLastTranscript > 3000 && transcripts.length > 0) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            ws?.removeAllListeners('message');
            const finalTranscript = transcripts.join(' ').trim();
            resolve(finalTranscript);
          }
        }, 300);

        ws?.on('message', handler);
      });

      const result = await transcriptPromise;

      // STEP 5: Close this WebSocket connection
      ws.close();
      
      return result;

    } catch (error) {
      if (ws) {
        ws.close();
      }
      console.error('[OpenAI Realtime] Transcription error:', error);
      throw error;
    }
  }

  /**
   * Streaming transcription using OpenAI Realtime API
   * Uses a persistent WebSocket connection for true streaming
   * 
   * Note: For batch transcription, use transcribe() instead as it avoids event mixing
   */
  async *transcribeStream(audioStream: AsyncIterable<Buffer>): AsyncIterable<string> {
    let ws: WebSocket | null = null;
    
    try {
      // Create a WebSocket connection for this stream
      ws = await this.connectRealtimeAPI();

      const transcriptQueue: string[] = [];
      let currentResolve: ((value: string | null) => void) | null = null;

      // Handle incoming transcription messages
      const messageHandler = (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Complete transcription
          if (message.type === 'conversation.item.input_audio_transcription.completed') {
            const transcript = message.transcript;
            if (transcript) {
              if (currentResolve) {
                currentResolve(transcript);
                currentResolve = null;
              } else {
                transcriptQueue.push(transcript);
              }
            }
          }
          
          // Partial transcription (streaming delta)
          if (message.type === 'conversation.item.input_audio_transcription.delta') {
            const delta = message.delta;
            if (delta) {
              if (currentResolve) {
                currentResolve(delta);
                currentResolve = null;
              } else {
                transcriptQueue.push(delta);
              }
            }
          }

        } catch (error) {
          console.error('[OpenAI Realtime] Message parse error:', error);
        }
      };

      ws.on('message', messageHandler);

      // Process audio stream
      for await (const chunk of audioStream) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          throw new Error('Connection lost during streaming');
        }

        // Send audio chunk as base64
        const base64Audio = chunk.toString('base64');
        ws.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64Audio,
        }));

        // Yield any queued transcripts immediately
        while (transcriptQueue.length > 0) {
          const transcript = transcriptQueue.shift();
          if (transcript) {
            yield transcript;
          }
        }

        // Wait for new transcription with timeout
        const transcript = await new Promise<string | null>((resolve) => {
          currentResolve = resolve;
          setTimeout(() => {
            if (currentResolve === resolve) {
              currentResolve = null;
              resolve(null);
            }
          }, 1000); // 1 second timeout per chunk
        });

        if (transcript) {
          yield transcript;
        }
      }

      // Yield any remaining transcripts
      while (transcriptQueue.length > 0) {
        const transcript = transcriptQueue.shift();
        if (transcript) {
          yield transcript;
        }
      }

      // Clean up
      ws.removeAllListeners('message');
      ws.close();

    } catch (error) {
      if (ws) {
        ws.close();
      }
      console.error('[OpenAI Realtime] Streaming error:', error);
      throw error;
    }
  }

  /**
   * Connect to OpenAI Realtime API
   * Returns a NEW WebSocket connection (doesn't reuse)
   */
  private async connectRealtimeAPI(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
        
        const ws = new WebSocket(url, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        });

        ws.on('open', () => {
          console.log('[OpenAI Realtime] Connected (fresh connection)');
          
          // Configure session for transcription only
          const sessionConfig = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              input_audio_transcription: {
                model: 'whisper-1',
              },
              turn_detection: null, // We'll handle turn detection ourselves
            },
          };
          ws.send(JSON.stringify(sessionConfig));
          
          resolve(ws);
        });

        ws.on('error', (error) => {
          console.error('[OpenAI Realtime] Connection error:', error);
          reject(error);
        });

        // Timeout connection attempt after 5 seconds
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            reject(new Error('Realtime API connection timeout'));
          }
        }, 5000);

      } catch (error) {
        console.error('[OpenAI Realtime] Connection setup error:', error);
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    // No persistent connection to close
  }
}
