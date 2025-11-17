/**
 * Enhanced Event System for Voice Agent SDK
 * Inspired by OpenAI Realtime API
 */

export type VoiceAgentEventType =
  // Session Events
  | 'session.created'
  | 'session.updated'
  | 'session.closed'
  
  // Connection Events
  | 'connection.created'
  | 'connection.established'
  | 'connection.closed'
  | 'connection.error'
  
  // Audio Events
  | 'audio.input.started'
  | 'audio.input.stopped'
  | 'audio.input.buffer.speech_started'
  | 'audio.input.buffer.speech_stopped'
  | 'audio.input.buffer.committed'
  | 'audio.input.buffer.cleared'
  | 'audio.output.started'
  | 'audio.output.done'
  | 'audio.output.speech.started'
  | 'audio.output.speech.stopped'
  | 'audio.output.item.done'
  
  // Transcription Events
  | 'transcription.delta'
  | 'transcription.done'
  | 'transcription.failed'
  
  // Response Events
  | 'response.created'
  | 'response.started'
  | 'response.text.delta'
  | 'response.text.done'
  | 'response.audio.delta'
  | 'response.audio.done'
  | 'response.tool.call'
  | 'response.done'
  | 'response.cancelled'
  | 'response.failed'
  
  // Conversation Events
  | 'conversation.item.created'
  | 'conversation.item.input_audio_transcription.completed'
  | 'conversation.item.input_audio_transcription.failed'
  | 'conversation.item.truncated'
  | 'conversation.item.deleted'
  
  // Agent Events
  | 'agent.processing.started'
  | 'agent.processing.completed'
  | 'agent.processing.failed'
  | 'agent.interrupted'
  | 'agent.handoff'
  
  // Error Events
  | 'error'
  | 'rate_limit.updated';

/**
 * Base event interface
 */
export interface BaseEvent {
  type: VoiceAgentEventType;
  event_id: string;
  timestamp: string;
  session_id?: string;
}

/**
 * Session Events
 */
export interface SessionCreatedEvent extends BaseEvent {
  type: 'session.created';
  session: {
    id: string;
    object: 'session';
    model: string;
    modalities: string[];
    instructions: string;
    voice: string;
    input_audio_format: string;
    output_audio_format: string;
    input_audio_transcription?: {
      enabled: boolean;
      model: string;
    };
    turn_detection?: {
      type: string;
      threshold: number;
      prefix_padding_ms: number;
      silence_duration_ms: number;
    };
    tools?: Array<{
      type: 'function';
      name: string;
      description: string;
      parameters: Record<string, any>;
    }>;
    tool_choice: string;
    temperature: number;
    max_response_output_tokens: number | 'inf';
  };
}

export interface SessionUpdatedEvent extends BaseEvent {
  type: 'session.updated';
  session: SessionCreatedEvent['session'];
}

/**
 * Audio Events
 */
export interface AudioInputStartedEvent extends BaseEvent {
  type: 'audio.input.started';
  audio_start_ms: number;
  item_id?: string;
}

export interface AudioInputBufferSpeechStartedEvent extends BaseEvent {
  type: 'audio.input.buffer.speech_started';
  audio_start_ms: number;
  item_id: string;
}

export interface AudioInputBufferSpeechStoppedEvent extends BaseEvent {
  type: 'audio.input.buffer.speech_stopped';
  audio_end_ms: number;
  item_id: string;
}

export interface AudioOutputStartedEvent extends BaseEvent {
  type: 'audio.output.started';
  item_id: string;
  output_index: number;
  content_index: number;
}

export interface AudioOutputDoneEvent extends BaseEvent {
  type: 'audio.output.done';
  item_id: string;
  output_index: number;
  content_index: number;
}

/**
 * Transcription Events
 */
export interface TranscriptionDeltaEvent extends BaseEvent {
  type: 'transcription.delta';
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string;
  transcript: string;
}

export interface TranscriptionDoneEvent extends BaseEvent {
  type: 'transcription.done';
  item_id: string;
  output_index: number;
  content_index: number;
  transcript: string;
}

/**
 * Response Events
 */
export interface ResponseCreatedEvent extends BaseEvent {
  type: 'response.created';
  response: {
    id: string;
    object: 'response';
    status: 'in_progress' | 'completed' | 'cancelled' | 'failed' | 'incomplete';
    status_details?: any;
    output: Array<{
      id: string;
      object: 'item';
      type: 'message' | 'function_call' | 'function_call_output';
      status: 'in_progress' | 'completed' | 'incomplete';
      role: 'system' | 'user' | 'assistant';
      content?: Array<{
        type: 'text' | 'audio';
        text?: string;
        audio?: string;
        transcript?: string;
      }>;
    }>;
    usage?: {
      total_tokens: number;
      input_tokens: number;
      output_tokens: number;
    };
  };
}

export interface ResponseTextDeltaEvent extends BaseEvent {
  type: 'response.text.delta';
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string;
  text: string;
}

export interface ResponseAudioDeltaEvent extends BaseEvent {
  type: 'response.audio.delta';
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string; // base64 encoded audio
}

export interface ResponseDoneEvent extends BaseEvent {
  type: 'response.done';
  response: ResponseCreatedEvent['response'];
}

/**
 * Tool Call Events
 */
export interface ResponseToolCallEvent extends BaseEvent {
  type: 'response.tool.call';
  item_id: string;
  output_index: number;
  call_id: string;
  name: string;
  arguments: string;
}

/**
 * Error Event
 */
export interface ErrorEvent extends BaseEvent {
  type: 'error';
  error: {
    type: string;
    code: string;
    message: string;
    param?: string;
    event_id?: string;
  };
}

/**
 * Rate Limit Event
 */
export interface RateLimitEvent extends BaseEvent {
  type: 'rate_limit.updated';
  rate_limits: Array<{
    name: string;
    limit: number;
    remaining: number;
    reset_seconds: number;
  }>;
}

/**
 * Union type of all events
 */
export type VoiceAgentEvent =
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | AudioInputStartedEvent
  | AudioInputBufferSpeechStartedEvent
  | AudioInputBufferSpeechStoppedEvent
  | AudioOutputStartedEvent
  | AudioOutputDoneEvent
  | TranscriptionDeltaEvent
  | TranscriptionDoneEvent
  | ResponseCreatedEvent
  | ResponseTextDeltaEvent
  | ResponseAudioDeltaEvent
  | ResponseDoneEvent
  | ResponseToolCallEvent
  | ErrorEvent
  | RateLimitEvent
  | BaseEvent;

/**
 * Event emitter interface
 */
export interface VoiceAgentEventEmitter {
  on<T extends VoiceAgentEventType>(
    event: T,
    listener: (data: Extract<VoiceAgentEvent, { type: T }>) => void
  ): void;
  
  off<T extends VoiceAgentEventType>(
    event: T,
    listener: (data: Extract<VoiceAgentEvent, { type: T }>) => void
  ): void;
  
  emit<T extends VoiceAgentEventType>(
    event: T,
    data: Extract<VoiceAgentEvent, { type: T }>
  ): void;
  
  once<T extends VoiceAgentEventType>(
    event: T,
    listener: (data: Extract<VoiceAgentEvent, { type: T }>) => void
  ): void;
}

/**
 * Client message types for WebSocket/WebRTC communication
 */
export type ClientMessageType =
  | 'session.update'
  | 'input_audio_buffer.append'
  | 'input_audio_buffer.commit'
  | 'input_audio_buffer.clear'
  | 'conversation.item.create'
  | 'conversation.item.truncate'
  | 'conversation.item.delete'
  | 'response.create'
  | 'response.cancel';

export interface ClientMessage {
  type: ClientMessageType;
  [key: string]: any;
}

export interface SessionUpdateMessage extends ClientMessage {
  type: 'session.update';
  session: Partial<SessionCreatedEvent['session']>;
}

export interface InputAudioBufferAppendMessage extends ClientMessage {
  type: 'input_audio_buffer.append';
  audio: string; // base64 encoded audio
}

export interface InputAudioBufferCommitMessage extends ClientMessage {
  type: 'input_audio_buffer.commit';
}

export interface ConversationItemCreateMessage extends ClientMessage {
  type: 'conversation.item.create';
  item: {
    type: 'message' | 'function_call' | 'function_call_output';
    role?: 'system' | 'user' | 'assistant';
    content?: Array<{
      type: 'input_text' | 'input_audio' | 'text' | 'audio';
      text?: string;
      audio?: string;
      transcript?: string;
    }>;
    call_id?: string;
    name?: string;
    arguments?: string;
    output?: string;
  };
  previous_item_id?: string;
}

export interface ResponseCreateMessage extends ClientMessage {
  type: 'response.create';
  response?: {
    modalities?: string[];
    instructions?: string;
    voice?: string;
    output_audio_format?: string;
    tools?: Array<{
      type: 'function';
      name: string;
      description: string;
      parameters: Record<string, any>;
    }>;
    tool_choice?: string;
    temperature?: number;
    max_output_tokens?: number | 'inf';
  };
}

export interface ResponseCancelMessage extends ClientMessage {
  type: 'response.cancel';
  response_id?: string;
}

