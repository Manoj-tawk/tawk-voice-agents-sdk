/**
 * Voice Agent SDK - Main Entry Point
 * 
 * Production-ready Voice AI SDK with WebSocket and WebRTC server-to-server support,
 * powered by tawk-agents-sdk for agent orchestration and multi-provider STT/TTS integration.
 * 
 * @packageDocumentation
 * @module voice-agent-sdk
 * @author Manoj
 * @license MIT
 * @version 1.0.0
 */

// ============================================
// CORE EXPORTS - Agents SDK
// ============================================
export * from './agents-sdk';

// ============================================
// TRANSPORT LAYER
// ============================================
export {
  WebSocketServer,
  WebSocketConnection,
  WebRTCServer,
  WebRTCServerConnection,
} from './transport';

export type {
  WebSocketServerConfig,
  WebRTCServerConfig,
  WebRTCSignalingMessage,
} from './transport';

// ============================================
// PROVIDERS - STT, TTS, VAD
// ============================================
export {
  // STT Providers
  DeepgramSTTProvider,
  AssemblyAISTTProvider,
  OpenAIWhisperSTTProvider,
  createSTTProvider,
  
  // TTS Providers
  ElevenLabsTTSProvider,
  CartesiaTTSProvider,
  OpenAITTSProvider,
  DeepgramTTSProvider,
  AzureTTSProvider,
  createTTSProvider,
  
  // VAD Providers
  EnergyVADProvider,
  createVADProvider,
} from './providers';

// ============================================
// VOICE AGENT
// ============================================
export { VoiceAgent, VoiceAgentConfig } from './voice-agent';

// ============================================
// TYPES
// ============================================
export type {
  // Event types
  VoiceAgentEventType,
  VoiceAgentEvent,
  VoiceAgentEventEmitter,
  SessionCreatedEvent,
  SessionUpdatedEvent,
  AudioInputStartedEvent,
  AudioOutputStartedEvent,
  TranscriptionDeltaEvent,
  TranscriptionDoneEvent,
  ResponseCreatedEvent,
  ResponseTextDeltaEvent,
  ResponseAudioDeltaEvent,
  ResponseDoneEvent,
  ResponseToolCallEvent,
  ErrorEvent,
  RateLimitEvent,
  ClientMessage,
  ClientMessageType,
  SessionUpdateMessage,
  InputAudioBufferAppendMessage,
  ConversationItemCreateMessage,
  ResponseCreateMessage,
  ResponseCancelMessage,
  
  // Provider types
  STTProvider,
  LLMProvider,
  TTSProvider,
  VADProvider,
  
  // Configuration types
  STTConfig,
  LLMConfig,
  TTSConfig,
  VADConfig,
  
  // Common types
  Message,
  Tool,
  ToolCall,
  LLMChunk,
  AudioFormat,
  Metrics,
} from './types';

// ============================================
// UTILITIES
// ============================================
export {
  Logger,
  AudioBuffer,
  ConversationManager,
  retry,
} from './utils';

/**
 * Default export - VoiceAgent
 */
export { VoiceAgent as default } from './voice-agent';

