import { EventEmitter } from 'events';
import WebSocket from 'isomorphic-ws';

/**
 * Voice Agent SDK - Client
 * 
 * Easy-to-use WebSocket client for voice AI agents
 * Similar to OpenAI's Realtime API
 */
export class VoiceAgentClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private mediaRecorder: any = null;
  private audioContext: any = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(private config: ClientConfig) {
    super();
  }

  /**
   * Connect to WebSocket server
   */
  async connect(url?: string): Promise<void> {
    const wsUrl = url || this.config.url || 'ws://localhost:8080';

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-API-Version': '2024-11-10'
        }
      } as any);

      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('[SDK] Connected to server');
        this.reconnectAttempts = 0;
        this.createSession();
        this.emit('connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('[SDK] WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      };

      this.ws.onmessage = (event: any) => {
        this.handleMessage(event);
      };

      this.ws.onclose = () => {
        console.log('[SDK] Disconnected from server');
        this.handleDisconnect();
      };
    });
  }

  /**
   * Create a session with configuration
   */
  private createSession(): void {
    this.send({
      type: 'session.create',
      session: {
        model: {
          stt: this.config.stt || 'deepgram',
          llm: this.config.llm || 'gpt-4o-mini',
          tts: this.config.tts || 'elevenlabs'
        },
        voice: this.config.voice || 'alloy',
        instructions: this.config.instructions || 'You are a helpful assistant',
        turn_detection: {
          type: 'server_vad',
          threshold: this.config.vadThreshold || 0.5,
          silence_duration_ms: this.config.silenceDurationMs || 700,
          speech_duration_ms: this.config.speechDurationMs || 300
        },
        tools: this.config.tools || [],
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 150
      }
    });
  }

  /**
   * Start capturing audio from microphone
   */
  async startRecording(): Promise<void> {
    if (typeof window === 'undefined' || !navigator.mediaDevices) {
      throw new Error('Audio recording not supported in this environment');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 16000 
      });
      
      const source = this.audioContext.createMediaStreamSource(stream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e: any) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = this.float32ToPCM(inputData);
        this.sendAudio(pcmData);
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      this.emit('recording.started');
      console.log('[SDK] Recording started');
    } catch (error) {
      console.error('[SDK] Failed to start recording:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop audio recording
   */
  stopRecording(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.emit('recording.stopped');
    console.log('[SDK] Recording stopped');
  }

  /**
   * Send audio data to server
   */
  sendAudio(audioBuffer: Buffer | Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[SDK] WebSocket not ready, audio not sent');
      return;
    }

    // Send as binary frame
    this.ws.send(audioBuffer);
  }

  /**
   * Send text message
   */
  sendText(text: string): void {
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }]
      }
    });

    // Trigger response generation
    this.send({ type: 'response.create' });
  }

  /**
   * Update session configuration
   */
  updateSession(updates: Partial<SessionConfig>): void {
    this.send({
      type: 'session.update',
      session: updates
    });
  }

  /**
   * Cancel current response (interruption)
   */
  interrupt(): void {
    this.send({ type: 'response.cancel' });
    this.audioQueue = [];
    this.emit('interrupted');
    console.log('[SDK] Response interrupted');
  }

  /**
   * Add a tool/function to the session
   */
  addTool(tool: ToolDefinition): void {
    const currentTools = this.config.tools || [];
    currentTools.push(tool);
    
    this.send({
      type: 'session.update',
      session: {
        tools: currentTools
      }
    });
  }

  /**
   * Send tool execution result back to server
   */
  sendToolResult(callId: string, result: any): void {
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(result)
      }
    });

    // Continue the response
    this.send({ type: 'response.create' });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    // Handle binary audio data
    if (event.data instanceof ArrayBuffer) {
      const audioData = new Uint8Array(event.data);
      this.emit('audio.received', audioData);
      
      if (this.config.autoPlayAudio !== false) {
        this.queueAudio(audioData);
      }
      return;
    }

    // Handle JSON events
    try {
      const message = JSON.parse(event.data);
      this.handleEvent(message);
    } catch (error) {
      console.error('[SDK] Failed to parse message:', error);
      this.emit('error', error);
    }
  }

  /**
   * Handle individual events
   */
  private handleEvent(event: any): void {
    // Emit the raw event
    this.emit('event', event);

    switch (event.type) {
      case 'session.created':
        this.sessionId = event.session.id;
        this.emit('session.created', event.session);
        console.log('[SDK] Session created:', this.sessionId);
        break;

      case 'session.updated':
        this.emit('session.updated', event.session);
        break;

      case 'input_audio_buffer.speech_started':
        this.emit('speech.started', event);
        break;

      case 'input_audio_buffer.speech_stopped':
        this.emit('speech.stopped', event);
        break;

      case 'input_audio_buffer.committed':
        this.emit('audio.committed', event);
        break;

      case 'conversation.item.created':
        this.emit('conversation.item.created', event.item);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.emit('transcription', event.transcript);
        this.emit('conversation.item.transcription.completed', event);
        console.log('[SDK] Transcription:', event.transcript);
        break;

      case 'response.created':
        this.emit('response.created', event.response);
        break;

      case 'response.text.delta':
        this.emit('response.text.delta', event.delta);
        this.emit('response.text', event.delta);
        break;

      case 'response.text.done':
        this.emit('response.text.done', event.text);
        break;

      case 'response.audio.delta':
        const audioChunk = Buffer.from(event.delta, 'base64');
        this.emit('response.audio.delta', audioChunk);
        
        if (this.config.autoPlayAudio !== false) {
          this.queueAudio(audioChunk);
        }
        break;

      case 'response.audio.done':
        this.emit('response.audio.done');
        break;

      case 'response.function_call_arguments.delta':
        this.emit('tool.arguments.delta', {
          callId: event.call_id,
          delta: event.delta
        });
        break;

      case 'response.function_call_arguments.done':
        const toolCall = {
          id: event.call_id,
          name: event.name,
          arguments: JSON.parse(event.arguments)
        };
        this.emit('tool.call', toolCall);
        console.log('[SDK] Tool call:', toolCall.name);
        break;

      case 'response.done':
        this.emit('response.done', event.response);
        console.log('[SDK] Response complete');
        break;

      case 'response.cancelled':
        this.emit('response.cancelled');
        break;

      case 'error':
        const error = new Error(event.error.message);
        (error as any).code = event.error.code;
        this.emit('error', error);
        console.error('[SDK] Server error:', event.error);
        break;

      case 'rate_limits.updated':
        this.emit('rate_limits.updated', event.rate_limits);
        break;

      default:
        console.log('[SDK] Unknown event type:', event.type);
    }
  }

  /**
   * Queue audio for playback
   */
  private async queueAudio(audioData: Uint8Array): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
          sampleRate: 16000 
        });
      }

      const audioBuffer = await this.pcmToAudioBuffer(audioData);
      this.audioQueue.push(audioBuffer);

      if (!this.isPlaying) {
        this.playNextAudio();
      }
    } catch (error) {
      console.error('[SDK] Failed to queue audio:', error);
    }
  }

  /**
   * Play next audio buffer in queue
   */
  private playNextAudio(): void {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift()!;

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    source.onended = () => {
      this.playNextAudio();
    };

    source.start();
    this.emit('audio.playing');
  }

  /**
   * Convert PCM16 to AudioBuffer
   */
  private async pcmToAudioBuffer(pcmData: Uint8Array): Promise<AudioBuffer> {
    const audioBuffer = this.audioContext.createBuffer(
      1,
      pcmData.length / 2,
      16000
    );

    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcmData.length / 2; i++) {
      const int16 = (pcmData[i * 2 + 1] << 8) | pcmData[i * 2];
      const float32 = int16 / (int16 < 0 ? 32768 : 32767);
      channelData[i] = float32;
    }

    return audioBuffer;
  }

  /**
   * Convert Float32 to PCM16
   */
  private float32ToPCM(float32Array: Float32Array): Buffer {
    const buffer = Buffer.alloc(float32Array.length * 2);
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      const int16 = sample < 0 ? sample * 32768 : sample * 32767;
      buffer.writeInt16LE(int16, i * 2);
    }
    return buffer;
  }

  /**
   * Send JSON message to server
   */
  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[SDK] Cannot send message, WebSocket not open');
    }
  }

  /**
   * Handle disconnect and attempt reconnection
   */
  private handleDisconnect(): void {
    this.emit('disconnected');
    
    if (this.config.autoReconnect !== false && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`[SDK] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        this.connect(this.config.url).catch(error => {
          console.error('[SDK] Reconnect failed:', error);
        });
      }, delay);
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.config.autoReconnect = false;
    this.stopRecording();
    this.audioQueue = [];
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.emit('closed');
    console.log('[SDK] Disconnected');
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
}

// Types
export interface ClientConfig {
  apiKey: string;
  url?: string;
  stt?: string;
  llm?: string;
  tts?: string;
  voice?: string;
  instructions?: string;
  vadThreshold?: number;
  silenceDurationMs?: number;
  speechDurationMs?: number;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  autoPlayAudio?: boolean;
  autoReconnect?: boolean;
}

export interface SessionConfig {
  model?: {
    stt?: string;
    llm?: string;
    tts?: string;
  };
  voice?: string;
  instructions?: string;
  turn_detection?: {
    type: 'server_vad';
    threshold?: number;
    silence_duration_ms?: number;
    speech_duration_ms?: number;
  };
  tools?: ToolDefinition[];
  temperature?: number;
  max_tokens?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Export default
export default VoiceAgentClient;
