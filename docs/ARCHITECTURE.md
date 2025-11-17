# Architecture Guide

Complete architecture overview of Tawk Voice Agents SDK - a new SDK for building voice AI applications built on top of Tawk Agents SDK.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                         │
│         (MediaSoup, Telephony, WebSocket, etc.)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Transport Layer                                 │
│         WebSocket Server / WebRTC Server                    │
│  - Connection management                                    │
│  - Message routing                                          │
│  - Audio streaming                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Voice Agent Pipeline                           │
│                                                              │
│   ┌─────────┐    ┌──────────────────┐    ┌─────────┐     │
│   │   STT   │───▶│ Tawk Agents SDK  │───▶│   TTS   │     │
│   │ Provider│    │   (LLM Layer)    │    │ Provider│     │
│   └─────────┘    └──────┬───────────┘    └─────────┘     │
│                         │                                  │
│                    ┌────▼────┐                            │
│                    │  Tools  │                            │
│                    │Handoffs │                            │
│                    │Guardrails│                           │
│                    │ Sessions │                            │
│                    └─────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Transport Layer

Handles server-to-server communication.

**WebSocket Server:**
- Manages WebSocket connections
- Routes messages and audio data
- Handles connection lifecycle

**WebRTC Server:**
- Manages WebRTC peer connections
- Handles ICE/DTLS negotiation
- Streams audio bidirectionally

### 2. Voice Agent

Orchestrates the complete pipeline.

**Responsibilities:**
- Audio/text input handling
- Provider coordination
- Event emission
- State management
- Error handling

**Key Features:**
- Multi-modal input (audio/text)
- Dual output (text + audio)
- Debouncing (500ms)
- Interruption support
- Metrics tracking

### 3. STT Providers

Convert speech to text.

**Supported Providers:**
- Deepgram Nova-2
- AssemblyAI Universal Streaming
- OpenAI Whisper

**Interface:**
```typescript
interface STTProvider {
  transcribe(audio: Buffer): Promise<string>;
  transcribeStream(audioStream: AsyncIterable<Buffer>): AsyncIterable<string>;
  stop(): Promise<void>;
}
```

### 4. Tawk Agents SDK (LLM Layer)

**Powered by Tawk Agents SDK** - Provides the LLM orchestration layer.

**Responsibilities:**
- LLM orchestration
- Tool calling
- Multi-agent handoffs
- Guardrails
- Session/memory management
- Tracing

**Key Point:** Configure agents directly, not through a separate LLM provider abstraction.

### 5. TTS Providers

Convert text to speech.

**Supported Providers:**
- ElevenLabs Turbo v2.5
- Cartesia Sonic (fastest)
- OpenAI TTS
- Deepgram Aura-2
- Azure Neural TTS

**Interface:**
```typescript
interface TTSProvider {
  synthesize(text: string): AsyncIterable<Buffer>;
  synthesizeStream(textStream: AsyncIterable<string>): AsyncIterable<Buffer>;
  stop(): Promise<void>;
}
```

### 6. VAD Providers

Voice Activity Detection.

**Supported Providers:**
- Energy-based VAD

**Interface:**
```typescript
interface VADProvider {
  detect(audio: Buffer): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

---

## Data Flow

### Audio Input Flow

```
1. Audio arrives via Transport
   └─> WebSocket/WebRTC receives audio chunks
   │
   ▼
2. AudioBuffer collects chunks
   ├─> Debouncing (500ms silence threshold)
   ├─> VAD filtering (if enabled)
   └─> Buffering until complete utterance
   │
   ▼
3. STT Provider transcribes
   ├─> Deepgram/AssemblyAI/OpenAI
   └─> Returns text transcript
   │
   ▼
4. Tawk Agents SDK processes
   ├─> Runs Agent with LLM
   ├─> Executes tools if needed
   ├─> Handles handoffs if needed
   ├─> Applies guardrails
   ├─> Manages session/memory
   └─> Returns text response
   │
   ▼
5. TTS Provider synthesizes
   ├─> ElevenLabs/Cartesia/OpenAI/etc.
   ├─> Sentence-by-sentence synthesis
   └─> Returns audio chunks
   │
   ▼
6. Audio chunks sent via Transport
   └─> WebSocket/WebRTC sends to client
```

### Text Input Flow

```
1. Text arrives via Transport
   └─> WebSocket receives text message
   │
   ▼
2. Tawk Agents SDK processes (STT skipped)
   ├─> Runs Agent with LLM
   ├─> Executes tools if needed
   ├─> Handles handoffs if needed
   ├─> Applies guardrails
   ├─> Manages session/memory
   └─> Returns text response
   │
   ▼
3. TTS Provider synthesizes
   ├─> ElevenLabs/Cartesia/OpenAI/etc.
   ├─> Sentence-by-sentence synthesis
   └─> Returns audio chunks
   │
   ▼
4. Audio chunks sent via Transport
   └─> WebSocket/WebRTC sends to client
```

**Key Point:** Both flows ALWAYS produce text + audio output.

---

## Event System

VoiceAgent extends EventEmitter and emits events throughout the pipeline.

### Event Flow

```
processAudio/processText
    ↓
processing.started
    ↓
transcription (for audio input)
    ↓
response.text.delta (streaming)
    ↓
response.text (complete)
    ↓
audio.started
    ↓
audio.chunk (streaming)
    ↓
audio.ended
    ↓
processing.stopped
```

### Event Types

**Lifecycle:**
- `ready` - Agent initialized
- `stopped` - Agent stopped

**Processing:**
- `processing.started` - Processing started
- `processing.stopped` - Processing completed
- `interrupted` - Response interrupted

**Transcription:**
- `transcription` - STT transcription complete

**Response:**
- `response.text.delta` - Streaming text chunk
- `response.text` - Complete text response

**Audio:**
- `audio.started` - Audio synthesis started
- `audio.chunk` - Audio chunk ready
- `audio.ended` - Audio synthesis ended

**Tools:**
- `tool.call` - Tool was called

**Agent:**
- `agent.handoff` - Handoff occurred

**Metrics:**
- `usage` - Token usage
- `metrics` - Performance metrics

**Error:**
- `error` - Error occurred

---

## Key Design Decisions

### 1. Built on Tawk Agents SDK

**Decision:** Tawk Voice Agents SDK is built on top of Tawk Agents SDK for LLM orchestration.

**Rationale:**
- Full agent capabilities (tools, handoffs, guardrails)
- Production-ready features (sessions, tracing, error handling)
- Direct access to agent features
- Consistent with Tawk ecosystem

**Implementation:**
```typescript
agent: {
  model: openai('gpt-4o'),
  tools: { myTool },
  handoffs: [otherAgent],
  guardrails: [...],
  session: mySession,
}
```

### 2. Multi-Modal Input

**Decision:** Support both audio and text input.

**Rationale:**
- Flexibility for different use cases
- Better testing/debugging
- Supports chat interfaces
- Accessibility

**Implementation:**
```typescript
await voiceAgent.processAudio(audioBuffer);  // Audio input
await voiceAgent.processText('Hello');       // Text input
```

### 3. Dual Output

**Decision:** ALWAYS generate both text and audio.

**Rationale:**
- Transcription included
- Better debugging
- Text-based analytics
- Accessibility

**Implementation:**
```typescript
voiceAgent.on('response.text', (text) => { /* text output */ });
voiceAgent.on('audio.chunk', (chunk) => { /* audio output */ });
```

### 4. Event-Driven Architecture

**Decision:** Use EventEmitter for all communication.

**Rationale:**
- Decoupled components
- Easy integration
- Real-time updates
- Flexible event handling

### 5. Debouncing

**Decision:** Use 500ms debouncing for audio input.

**Rationale:**
- Prevents fragmentation
- Waits for complete utterances
- Better transcription accuracy
- Reduces API calls

**Implementation:**
```typescript
// Automatic debouncing in processAudio()
this.processingTimeout = setTimeout(async () => {
  await this.processBufferedAudio();
}, 500);
```

### 6. Sentence-by-Sentence TTS

**Decision:** Synthesize audio sentence-by-sentence.

**Rationale:**
- Lower latency
- Better interruption support
- Streaming audio output
- Better user experience

---

## Provider Pattern

All providers implement interfaces for easy swapping.

### STT Provider Interface

```typescript
interface STTProvider {
  transcribe(audio: Buffer): Promise<string>;
  transcribeStream(audioStream: AsyncIterable<Buffer>): AsyncIterable<string>;
  stop(): Promise<void>;
}
```

### TTS Provider Interface

```typescript
interface TTSProvider {
  synthesize(text: string): AsyncIterable<Buffer>;
  synthesizeStream(textStream: AsyncIterable<string>): AsyncIterable<Buffer>;
  stop(): Promise<void>;
}
```

### Adding New Providers

1. Implement the interface
2. Add to provider factory
3. Update configuration types

---

## Session Management

Sessions are managed by Tawk Agents SDK.

**Types:**
- `MemorySession` - In-memory (development)
- `RedisSession` - Redis-backed (production)
- `MongoDBSession` - MongoDB-backed (production)

**Usage:**
```typescript
import { MemorySession } from '@tawk/voice-agents-sdk/core';

const session = new MemorySession('session-id');

const voiceAgent = new VoiceAgent({
  agent: {
    session,
    // ... rest of config
  },
});
```

---

## Error Handling

Errors are emitted as events and should be handled.

```typescript
voiceAgent.on('error', (error: Error) => {
  console.error('Error:', error);
  // Handle gracefully
});
```

**Common Errors:**
- STT provider errors
- LLM API errors
- TTS provider errors
- Network errors
- Timeout errors

---

## Performance Optimization

### Latency Breakdown

| Component | Typical Latency |
|-----------|----------------|
| STT       | ~200ms         |
| LLM       | ~300-1000ms    |
| TTS       | ~150-300ms     |
| **Total** | **~650-1500ms** |

### Optimization Strategies

1. **Use streaming providers** - Reduces latency
2. **Enable interruption** - Better UX
3. **Use faster TTS** - Cartesia is fastest (~150ms)
4. **Optimize audio format** - PCM16, 16kHz, mono
5. **Use VAD** - Filter silence

---

## Scalability

### Horizontal Scaling

- Stateless design (sessions in Redis/MongoDB)
- Multiple server instances
- Load balancer in front

### Vertical Scaling

- Single server handles multiple connections
- Event-driven (non-blocking)
- Efficient resource usage

---

## Security Considerations

1. **API Keys** - Store securely, never commit
2. **Authentication** - Use API keys for WebSocket
3. **Rate Limiting** - Implement at transport layer
4. **Input Validation** - Validate all inputs
5. **Error Messages** - Don't expose sensitive info

---

## Monitoring & Observability

### Metrics

```typescript
voiceAgent.on('metrics', (metrics) => {
  // Track latency
  // Track turns
  // Track errors
});
```

### Tracing

Tawk Agents SDK includes Langfuse integration:

```typescript
import { initializeLangfuse } from '@tawk/voice-agents-sdk/core';

initializeLangfuse();
// All agent runs are automatically traced
```

---

## How to Test

### Testing Architecture Components

```typescript
// Test STT Provider
import { createSTTProvider } from '@tawk/voice-agents-sdk/providers';

const stt = createSTTProvider({
  provider: 'deepgram',
  apiKey: 'test-key',
});

const transcript = await stt.transcribe(audioBuffer);
expect(transcript).toBeTruthy();

// Test TTS Provider
import { createTTSProvider } from '@tawk/voice-agents-sdk/providers';

const tts = createTTSProvider({
  provider: 'elevenlabs',
  apiKey: 'test-key',
});

const audioStream = tts.synthesize('Hello');
for await (const chunk of audioStream) {
  expect(chunk).toBeInstanceOf(Buffer);
}

// Test Transport Layer
import { WebSocketServer } from '@tawk/voice-agents-sdk/core';

const server = new WebSocketServer({ port: 8080 });
server.on('connection', (connection, sessionId) => {
  expect(sessionId).toBeTruthy();
});
```

---

## See Also

- [API Reference](./API.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [Project Structure](./PROJECT_STRUCTURE.md)
- [Tawk Agents SDK Integration](./AGENTS_SDK_INTEGRATION.md)
