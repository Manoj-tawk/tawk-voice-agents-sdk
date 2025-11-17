# Project Structure

Complete overview of the Tawk Voice Agents SDK codebase structure. This new SDK is organized to make it easy to understand, use, and test.

## Directory Structure

```
tawk-voice-agents-sdk/
├── src/                          # Source code
│   ├── agents-sdk/               # Tawk Agents SDK integration
│   │   ├── agent.ts              # Agent class
│   │   ├── handoff.ts            # Multi-agent handoffs
│   │   ├── guardrails.ts         # Safety & validation
│   │   ├── session.ts            # Session management
│   │   ├── tool.ts               # Tool definition
│   │   ├── tracing.ts            # Observability
│   │   ├── langfuse.ts           # Langfuse integration
│   │   └── index.ts              # Main exports
│   │
│   ├── voice-agent/              # Core VoiceAgent class
│   │   ├── voice-agent.ts        # Main VoiceAgent implementation
│   │   └── index.ts              # Exports
│   │
│   ├── providers/                 # Provider implementations
│   │   ├── stt/                  # Speech-to-Text providers
│   │   │   ├── deepgram.ts       # Deepgram STT
│   │   │   ├── assemblyai.ts     # AssemblyAI STT
│   │   │   ├── openai.ts         # OpenAI Whisper
│   │   │   └── index.ts          # STT factory
│   │   │
│   │   ├── tts/                  # Text-to-Speech providers
│   │   │   ├── elevenlabs.ts     # ElevenLabs TTS
│   │   │   ├── cartesia.ts       # Cartesia TTS
│   │   │   ├── openai.ts         # OpenAI TTS
│   │   │   ├── deepgram.ts       # Deepgram Aura
│   │   │   ├── azure.ts          # Azure Neural TTS
│   │   │   └── index.ts          # TTS factory
│   │   │
│   │   ├── vad/                  # Voice Activity Detection
│   │   │   ├── energy-vad.ts     # Energy-based VAD
│   │   │   └── index.ts          # VAD factory
│   │   │
│   │   └── index.ts              # Provider exports
│   │
│   ├── transport/                # Transport layer
│   │   ├── websocket-server.ts   # WebSocket server
│   │   ├── webrtc-server.ts      # WebRTC server
│   │   └── index.ts               # Transport exports
│   │
│   ├── types/                     # TypeScript types
│   │   ├── events.ts             # Event type definitions
│   │   └── index.ts               # Type exports
│   │
│   ├── utils/                     # Utility functions
│   │   ├── audio-buffer.ts       # Audio buffering
│   │   ├── audio-converter.ts    # Audio format conversion
│   │   ├── conversation-manager.ts # Conversation management
│   │   ├── logger.ts             # Logging utility
│   │   ├── retry.ts              # Retry logic
│   │   └── index.ts               # Utility exports
│   │
│   ├── client/                    # Client-side code
│   │   └── index.ts               # Client exports
│   │
│   ├── server/                    # Server-side code
│   │   └── index.ts               # Server exports
│   │
│   └── index.ts                   # Main entry point
│
├── examples/                      # Usage examples
│   ├── correct-architecture.ts    # Usage pattern example
│   ├── multi-modal-agent.ts      # Multi-modal demo
│   ├── openai-all-models-server.ts # Full server example
│   ├── mediasoup-integration.ts  # MediaSoup integration
│   └── browser.html              # Browser client example
│
├── docs/                          # Documentation
│   ├── API.md                     # API reference
│   ├── ARCHITECTURE.md            # Architecture guide
│   ├── INTEGRATION_GUIDE.md       # Integration guide
│   ├── AGENTS_SDK_INTEGRATION.md  # Tawk Agents SDK guide
│   ├── MULTI_MODAL_GUIDE.md       # Multi-modal guide
│   ├── PROJECT_STRUCTURE.md       # This file
│   └── MARKET_COMPARISON.md      # Market comparison
│
├── tests/                         # Test files
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   └── e2e/                       # End-to-end tests
│
├── dist/                          # Build output (generated)
├── package.json                   # Package configuration
├── tsconfig.json                  # TypeScript configuration
└── README.md                      # Main README
```

---

## Core Modules

### 1. Voice Agent (`src/voice-agent/`)

The main VoiceAgent class orchestrates the complete pipeline:

**Key Files:**
- `voice-agent.ts` - Main implementation (625 lines)
  - `VoiceAgent` class
  - `VoiceAgentConfig` interface
  - Audio/text processing
  - Event emission
  - Session management

**Responsibilities:**
- Orchestrates STT → Agent → TTS pipeline
- Handles multi-modal input (audio/text)
- Ensures dual output (text + audio)
- Manages conversation state
- Emits events for integration

---

### 2. Agents SDK (`src/agents-sdk/`)

Tawk Agents SDK integration - powers the LLM layer.

**Key Files:**
- `agent.ts` - Agent class
- `tool.ts` - Tool definition
- `handoff.ts` - Multi-agent handoffs
- `guardrails.ts` - Safety checks
- `session.ts` - Session management
- `tracing.ts` - Observability

**Responsibilities:**
- LLM orchestration
- Tool calling
- Multi-agent workflows
- Guardrails
- Session/memory management
- Tracing

---

### 3. Providers (`src/providers/`)

Provider implementations for STT, TTS, and VAD.

#### STT Providers (`src/providers/stt/`)

- **deepgram.ts** - Deepgram Nova-2 STT
- **assemblyai.ts** - AssemblyAI Universal Streaming
- **openai.ts** - OpenAI Whisper

**Interface:**
```typescript
interface STTProvider {
  transcribe(audio: Buffer): Promise<string>;
  transcribeStream(audioStream: AsyncIterable<Buffer>): AsyncIterable<string>;
  stop(): Promise<void>;
}
```

#### TTS Providers (`src/providers/tts/`)

- **elevenlabs.ts** - ElevenLabs Turbo v2.5
- **cartesia.ts** - Cartesia Sonic (fastest)
- **openai.ts** - OpenAI TTS
- **deepgram.ts** - Deepgram Aura-2
- **azure.ts** - Azure Neural TTS

**Interface:**
```typescript
interface TTSProvider {
  synthesize(text: string): AsyncIterable<Buffer>;
  synthesizeStream(textStream: AsyncIterable<string>): AsyncIterable<Buffer>;
  stop(): Promise<void>;
}
```

#### VAD Providers (`src/providers/vad/`)

- **energy-vad.ts** - Energy-based voice activity detection

**Interface:**
```typescript
interface VADProvider {
  detect(audio: Buffer): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

---

### 4. Transport Layer (`src/transport/`)

Server-to-server communication.

**Files:**
- `websocket-server.ts` - WebSocket server implementation
- `webrtc-server.ts` - WebRTC server implementation

**Key Classes:**
- `WebSocketServer` - WebSocket server
- `WebSocketConnection` - Individual connection handler
- `WebRTCServer` - WebRTC server

---

### 5. Utilities (`src/utils/`)

Helper utilities.

**Files:**
- `audio-buffer.ts` - Audio buffering with debouncing
- `audio-converter.ts` - Audio format conversion
- `conversation-manager.ts` - Conversation state management
- `logger.ts` - Structured logging
- `retry.ts` - Retry logic with exponential backoff

---

### 6. Types (`src/types/`)

TypeScript type definitions.

**Files:**
- `events.ts` - Event type definitions
- `index.ts` - Type exports

**Key Types:**
- `VoiceAgentEvent` - Event union type
- `Message` - Conversation message
- `Tool` - Tool definition
- `Metrics` - Performance metrics

---

## Data Flow

### Audio Input Flow

```
1. Audio arrives via Transport (WebSocket/WebRTC)
   ↓
2. AudioBuffer collects chunks (with debouncing)
   ↓
3. STT Provider transcribes audio → text
   ↓
4. Tawk Agents SDK processes text
   ├─> Runs Agent with LLM
   ├─> Executes tools if needed
   ├─> Handles handoffs if needed
   ├─> Applies guardrails
   └─> Manages session/memory
   ↓
5. TTS Provider synthesizes response → audio
   ↓
6. Audio chunks sent back via Transport
```

### Text Input Flow

```
1. Text arrives via Transport
   ↓
2. Tawk Agents SDK processes text (STT skipped)
   ├─> Runs Agent with LLM
   ├─> Executes tools if needed
   └─> Manages session/memory
   ↓
3. TTS Provider synthesizes response → audio
   ↓
4. Audio chunks sent back via Transport
```

**Key Point:** Both flows ALWAYS produce text + audio output.

---

## Key Design Decisions

### 1. Tawk Agents SDK as LLM Layer

**Decision:** Built on Tawk Agents SDK for LLM orchestration.

**Rationale:**
- Full agent capabilities (tools, handoffs, guardrails)
- No abstraction leaks
- Direct access to agent features
- Consistent with Tawk ecosystem

### 2. Multi-Modal Input

**Decision:** Support both audio and text input.

**Rationale:**
- Flexibility for different use cases
- Better testing/debugging
- Supports chat interfaces
- Accessibility

### 3. Dual Output

**Decision:** ALWAYS generate both text and audio.

**Rationale:**
- Transcription included
- Better debugging
- Text-based analytics
- Accessibility

### 4. Event-Driven Architecture

**Decision:** Use EventEmitter for all communication.

**Rationale:**
- Decoupled components
- Easy integration
- Real-time updates
- Flexible event handling

### 5. Provider Pattern

**Decision:** Abstract providers behind interfaces.

**Rationale:**
- Easy to add new providers
- No vendor lock-in
- Testable
- Flexible

---

## Adding New Providers

### Adding a New STT Provider

1. Create file: `src/providers/stt/new-provider.ts`
2. Implement `STTProvider` interface
3. Add to factory: `src/providers/stt/index.ts`

```typescript
// src/providers/stt/new-provider.ts
import { STTProvider } from '../../types';

export class NewSTTProvider implements STTProvider {
  async transcribe(audio: Buffer): Promise<string> {
    // Implementation
  }
  
  async transcribeStream(audioStream: AsyncIterable<Buffer>): AsyncIterable<string> {
    // Implementation
  }
  
  async stop(): Promise<void> {
    // Cleanup
  }
}
```

### Adding a New TTS Provider

Same pattern as STT provider.

---

## Testing Structure

```
tests/
├── unit/              # Unit tests
│   ├── voice-agent.test.ts
│   ├── providers.test.ts
│   └── utils.test.ts
│
├── integration/       # Integration tests
│   ├── multi-modal.test.ts
│   └── transport.test.ts
│
└── e2e/              # End-to-end tests
    └── full-pipeline.test.ts
```

---

## Build Output

The `dist/` directory contains compiled JavaScript and type definitions:

```
dist/
├── index.js           # Main entry point
├── index.d.ts         # Type definitions
├── voice-agent/       # VoiceAgent module
├── providers/         # Provider modules
├── transport/         # Transport modules
└── agents-sdk/        # Agents SDK module
```

---

## Entry Points

### Main Entry (`src/index.ts`)

Exports everything needed to use the SDK:

```typescript
export { VoiceAgent, VoiceAgentConfig } from './voice-agent';
export { WebSocketServer, WebRTCServer } from './transport';
export * from './providers';
export * from './agents-sdk';
export * from './types';
```

### Module Exports

- `@tawk/voice-agents-sdk` - Main package
- `@tawk/voice-agents-sdk/voice-agent` - VoiceAgent only
- `@tawk/voice-agents-sdk/transport` - Transport layer
- `@tawk/voice-agents-sdk/providers` - Providers
- `@tawk/voice-agents-sdk/core` - Tawk Agents SDK

---

## See Also

- [API Reference](./API.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
