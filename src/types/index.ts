/**
 * Shared types for Voice Agent SDK
 */

// Export event types
export * from './events';

// Base provider interfaces
export interface STTProvider {
  transcribe(audio: Buffer): Promise<string>;
  transcribeStream(audioStream: AsyncIterable<Buffer>): AsyncIterable<string>;
  stop(): Promise<void>;
}

export interface LLMProvider {
  generate(options: {
    messages: Message[];
    stream?: boolean;
    tools?: Tool[];
  }): Promise<AsyncIterable<LLMChunk> | string>;
  addTool(tool: Tool): void;
  stop(): Promise<void>;
}

export interface TTSProvider {
  synthesize(text: string): AsyncIterable<Buffer>;
  synthesizeStream(textStream: AsyncIterable<string>): AsyncIterable<Buffer>;
  stop(): Promise<void>;
}

export interface VADProvider {
  detect(audio: Buffer): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

// Message types
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: any;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (params: any) => Promise<any>;
}

export interface LLMChunk {
  type: 'text' | 'tool-call';
  content?: string;
  tool_call?: ToolCall;
  done?: boolean;
}

// Audio formats
export interface AudioFormat {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  encoding: 'pcm' | 'opus' | 'mp3';
}

// Configuration interfaces
export interface STTConfig {
  provider: 'deepgram' | 'assemblyai' | 'openai' | 'google' | 'azure';
  apiKey: string;
  model?: string;
  language?: string;
  streaming?: boolean;
  interimResults?: boolean;
  config?: any;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'groq';
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  streaming?: boolean;
  config?: any;
}

export interface TTSConfig {
  provider: 'elevenlabs' | 'cartesia' | 'openai' | 'deepgram' | 'azure' | 'google';
  apiKey: string;
  voiceId?: string;
  model?: string;
  streaming?: boolean;
  speed?: number;
  config?: any;
}

export interface VADConfig {
  enabled: boolean;
  silenceThresholdMs: number;
  speechThresholdMs: number;
  sensitivity?: number;
}

// Transport configurations
export interface WebSocketConfig {
  url: string;
  apiKey?: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
}

export interface WebRTCConfig {
  serverUrl: string;
  roomId: string;
  token?: string;
}

export interface MediaSoupConfig {
  serverUrl: string;
  roomId: string;
  token?: string;
}

// Voice Agent configuration
// VoiceAgentConfig is now exported from voice-agent module
// The new config uses agents-sdk directly as the LLM layer

/**
 * @deprecated Use VoiceAgentConfig from 'voice-agent-sdk/voice-agent' instead
 */
export interface VoiceAgentConfigOld {
  transport: {
    type: 'websocket' | 'webrtc' | 'mediasoup';
    websocket?: WebSocketConfig;
    webrtc?: WebRTCConfig;
    mediasoup?: MediaSoupConfig;
  };
  stt: STTConfig;
  llm: LLMConfig;
  tts: TTSConfig;
  vad?: VADConfig;
  interruption?: {
    enabled?: boolean;
    cancelOnNewInput?: boolean;
  };
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics?: boolean;
  };
}

// Metrics
export interface Metrics {
  totalLatency: number;
  sttLatency: number;
  llmLatency: number;
  ttsLatency: number;
  turns: number;
}

// Session
export interface SessionConfig {
  id?: string;
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
  tools?: Tool[];
  temperature?: number;
  max_tokens?: number;
}

// Client configuration
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
  tools?: Tool[];
  temperature?: number;
  maxTokens?: number;
  autoPlayAudio?: boolean;
  autoReconnect?: boolean;
}

// Server configuration
export interface ServerConfig {
  port?: number;
  server?: any; // HTTPServer
  apiKeys?: string[];
  sessionTimeout?: number;
  sendWelcome?: boolean;
  providers?: {
    stt?: {
      apiKey: string;
      defaultModel?: string;
    };
    llm?: {
      apiKey: string;
      defaultModel?: string;
    };
    tts?: {
      apiKey: string;
      defaultVoice?: string;
    };
  };
}

// WebSocket messages
export type WSMessage =
  | { type: 'session.create'; session: SessionConfig }
  | { type: 'session.update'; session: Partial<SessionConfig> }
  | { type: 'session.created'; session: SessionConfig }
  | { type: 'input_audio_buffer.append'; audio: string }
  | { type: 'input_audio_buffer.commit' }
  | { type: 'input_audio_buffer.clear' }
  | { type: 'input_audio_buffer.speech_started' }
  | { type: 'input_audio_buffer.speech_stopped' }
  | { type: 'input_audio_buffer.committed'; item_id: string }
  | { type: 'conversation.item.create'; item: any }
  | { type: 'conversation.item.created'; item: any }
  | { type: 'conversation.item.input_audio_transcription.completed'; transcript: string; item_id: string }
  | { type: 'response.create' }
  | { type: 'response.cancel' }
  | { type: 'response.created'; response: any }
  | { type: 'response.text.delta'; delta: string }
  | { type: 'response.text.done'; text: string }
  | { type: 'response.audio.delta'; delta: string; item_id?: string }
  | { type: 'response.audio.done' }
  | { type: 'response.done'; response: any }
  | { type: 'response.cancelled' }
  | { type: 'error'; error: { code: string; message: string } };

