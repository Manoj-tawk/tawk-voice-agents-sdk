# Tawk Voice Agents SDK - API Reference

Complete API documentation for Tawk Voice Agents SDK - a new SDK for building voice AI applications. Learn how to use all the APIs, methods, and events.

## Table of Contents

- [VoiceAgent](#voiceagent)
- [VoiceAgentConfig](#voiceagentconfig)
- [Events](#events)
- [Methods](#methods)
- [Transport Layer](#transport-layer)
- [Providers](#providers)
- [Examples](#examples)

---

## VoiceAgent

The main class for creating and managing voice agents.

### Constructor

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';

const agent = new VoiceAgent(config: VoiceAgentConfig);
```

### Class Definition

```typescript
export class VoiceAgent extends EventEmitter {
  constructor(config: VoiceAgentConfig);
  
  // Lifecycle
  async initialize(): Promise<void>;
  async stop(): Promise<void>;
  
  // Processing
  async processAudio(audioData: Buffer): Promise<void>;
  async processText(text: string): Promise<void>;
  async interrupt(): Promise<void>;
  
  // Session Management
  async getConversationHistory(): Promise<Message[]>;
  async clearHistory(): Promise<void>;
  
  // Utilities
  getAgent(): Agent;
  getMetrics(): Metrics;
}
```

---

## VoiceAgentConfig

Configuration interface for VoiceAgent.

```typescript
interface VoiceAgentConfig {
  // Transport configuration
  transport: {
    type: 'websocket' | 'webrtc' | 'mediasoup';
    websocket?: any;
    webrtc?: any;
    mediasoup?: any;
  };
  
  // STT Provider configuration
  stt: {
    provider: 'deepgram' | 'assemblyai' | 'openai';
    apiKey: string;
    model?: string;
    language?: string;
    streaming?: boolean;
  };
  
  // Agent configuration (powered by Tawk Agents SDK)
  agent: {
    model: LanguageModel;  // From @ai-sdk/* packages
    name?: string;
    instructions: string | ((context: any) => string);
    tools?: Record<string, Tool>;  // From Tawk Agents SDK
    handoffs?: Agent[];  // From Tawk Agents SDK
    guardrails?: Guardrail[];  // From Tawk Agents SDK
    session?: Session;  // From Tawk Agents SDK
    modelSettings?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    };
  };
  
  // TTS Provider configuration
  tts: {
    provider: 'elevenlabs' | 'cartesia' | 'openai' | 'deepgram' | 'azure';
    apiKey: string;
    voiceId?: string;
    model?: string;
    streaming?: boolean;
  };
  
  // VAD (Voice Activity Detection) - optional
  vad?: {
    enabled: boolean;
    silenceThresholdMs?: number;  // Default: 700
    speechThresholdMs?: number;   // Default: 300
    sensitivity?: number;
  };
  
  // Interruption handling
  interruption?: {
    enabled?: boolean;  // Default: false
    cancelOnNewInput?: boolean;  // Default: true
  };
  
  // Logging configuration
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';  // Default: 'info'
    enableMetrics?: boolean;  // Default: false
  };
}
```

### Configuration Example

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';
import { tool, MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const getWeather = tool({
  description: 'Get weather for a location',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return { temp: 72, condition: 'sunny' };
  },
});

const config: VoiceAgentConfig = {
  transport: {
    type: 'websocket',
  },
  
  stt: {
    provider: 'deepgram',
    apiKey: process.env.DEEPGRAM_API_KEY!,
    model: 'nova-2',
    streaming: true,
  },
  
  agent: {
    model: openai('gpt-4o'),
    name: 'VoiceAssistant',
    instructions: 'You are a helpful voice assistant. Keep responses brief.',
    tools: { getWeather },
    session: new MemorySession('session-id'),
    modelSettings: {
      temperature: 0.7,
      maxTokens: 150,
    },
  },
  
  tts: {
    provider: 'elevenlabs',
    apiKey: process.env.ELEVENLABS_API_KEY!,
    voiceId: process.env.ELEVENLABS_VOICE_ID!,
    streaming: true,
  },
  
  vad: {
    enabled: true,
    silenceThresholdMs: 700,
    speechThresholdMs: 300,
  },
  
  interruption: {
    enabled: true,
    cancelOnNewInput: true,
  },
  
  logging: {
    level: 'info',
    enableMetrics: true,
  },
};

const voiceAgent = new VoiceAgent(config);
```

---

## Methods

### `initialize()`

Initialize the voice agent. Must be called before processing.

```typescript
await voiceAgent.initialize();
```

**Returns:** `Promise<void>`

**Events Emitted:**
- `ready` - When initialization is complete

---

### `processAudio(audioData: Buffer)`

Process incoming audio data. Flow: Audio → STT → Tawk Agents SDK → TTS → Audio + Text output.

```typescript
await voiceAgent.processAudio(audioBuffer);
```

**Parameters:**
- `audioData: Buffer` - Raw audio data (PCM16, 16kHz, mono recommended)

**Returns:** `Promise<void>`

**Events Emitted:**
- `processing.started` - When processing begins
- `transcription` - When STT completes (text: string)
- `response.text.delta` - Streaming text chunks (delta: string)
- `response.text` - Complete text response (text: string)
- `audio.chunk` - Audio chunks from TTS (chunk: Buffer)
- `audio.started` - When audio synthesis starts (sentence: string)
- `audio.ended` - When audio synthesis ends (sentence: string)
- `tool.call` - When a tool is called (toolCall: { name, parameters, result })
- `agent.handoff` - When handoff occurs (handoff: { chain })
- `usage` - Token usage metrics (usage: { totalTokens, promptTokens, completionTokens })
- `metrics` - Performance metrics (metrics: Metrics)
- `processing.stopped` - When processing completes
- `error` - On error (error: Error)

**Note:** Uses debouncing (500ms) to wait for complete audio input before processing.

---

### `processText(text: string)`

Process text input directly. Flow: Text → Tawk Agents SDK → TTS → Audio + Text output.

```typescript
await voiceAgent.processText('What is the weather in Tokyo?');
```

**Parameters:**
- `text: string` - Input text

**Returns:** `Promise<void>`

**Events Emitted:**
- Same as `processAudio()` except:
  - `transcription` - Emits the input text (for consistency)
  - `metrics.sttLatency` - Will be 0

**Important:** Even with text input, audio output is ALWAYS generated via TTS.

---

### `interrupt()`

Interrupt the current response processing.

```typescript
await voiceAgent.interrupt();
```

**Returns:** `Promise<void>`

**Events Emitted:**
- `interrupted` - When interruption occurs

---

### `stop()`

Stop the voice agent and clean up resources.

```typescript
await voiceAgent.stop();
```

**Returns:** `Promise<void>`

**Events Emitted:**
- `stopped` - When stop completes

---

### `getConversationHistory()`

Get conversation history from the session.

```typescript
const history = await voiceAgent.getConversationHistory();
```

**Returns:** `Promise<Message[]>`

---

### `clearHistory()`

Clear conversation history.

```typescript
await voiceAgent.clearHistory();
```

**Returns:** `Promise<void>`

**Events Emitted:**
- `history.cleared` - When history is cleared

---

### `getAgent()`

Get the underlying Agent instance (for advanced usage).

```typescript
const agent = voiceAgent.getAgent();
```

**Returns:** `Agent` (from Tawk Agents SDK)

---

### `getMetrics()`

Get current performance metrics.

```typescript
const metrics = voiceAgent.getMetrics();
```

**Returns:** `Metrics`

```typescript
interface Metrics {
  totalLatency: number;  // Total end-to-end latency (ms)
  sttLatency: number;    // STT processing latency (ms)
  llmLatency: number;    // LLM processing latency (ms)
  ttsLatency: number;    // TTS synthesis latency (ms)
  turns: number;         // Number of conversation turns
}
```

---

## Events

VoiceAgent extends EventEmitter and emits the following events:

### Lifecycle Events

| Event | Payload | Description |
|-------|---------|-------------|
| `ready` | - | Agent initialized and ready |
| `stopped` | - | Agent stopped |

### Processing Events

| Event | Payload | Description |
|-------|---------|-------------|
| `processing.started` | - | Processing started |
| `processing.stopped` | - | Processing completed |
| `interrupted` | - | Response interrupted |

### Transcription Events

| Event | Payload | Description |
|-------|---------|-------------|
| `transcription` | `text: string` | STT transcription complete |

### Response Events

| Event | Payload | Description |
|-------|---------|-------------|
| `response.text.delta` | `delta: string` | Streaming text chunk |
| `response.text` | `text: string` | Complete text response |

### Audio Events

| Event | Payload | Description |
|-------|---------|-------------|
| `audio.started` | `sentence: string` | Audio synthesis started |
| `audio.chunk` | `chunk: Buffer` | Audio chunk ready for playback |
| `audio.ended` | `sentence: string` | Audio synthesis ended |

### Tool Events

| Event | Payload | Description |
|-------|---------|-------------|
| `tool.call` | `{ name, parameters, result }` | Tool was called |

### Agent Events

| Event | Payload | Description |
|-------|---------|-------------|
| `agent.handoff` | `{ chain }` | Handoff to another agent occurred |

### Metrics Events

| Event | Payload | Description |
|-------|---------|-------------|
| `usage` | `{ totalTokens, promptTokens, completionTokens }` | Token usage |
| `metrics` | `Metrics` | Performance metrics |

### Error Events

| Event | Payload | Description |
|-------|---------|-------------|
| `error` | `Error` | Error occurred |

### Session Events

| Event | Payload | Description |
|-------|---------|-------------|
| `history.cleared` | - | Conversation history cleared |

### Event Handling Example

```typescript
voiceAgent.on('transcription', (text: string) => {
  console.log('User said:', text);
});

voiceAgent.on('response.text.delta', (delta: string) => {
  process.stdout.write(delta);  // Stream text
});

voiceAgent.on('audio.chunk', (chunk: Buffer) => {
  // Send audio to client
  ws.send(chunk);
});

voiceAgent.on('tool.call', (toolCall) => {
  console.log(`Tool ${toolCall.name} called with:`, toolCall.parameters);
});

voiceAgent.on('metrics', (metrics) => {
  console.log('Latency:', metrics.totalLatency, 'ms');
});

voiceAgent.on('error', (error) => {
  console.error('Error:', error);
});
```

---

## Transport Layer

### WebSocketServer

```typescript
import { WebSocketServer, WebSocketConnection } from '@tawk/voice-agents-sdk/core';

const server = new WebSocketServer({
  port: 8080,
  host: '0.0.0.0',
  path: '/ws',
  apiKeys: ['your-api-key'],
  cors: {
    origin: '*',
  },
  heartbeatInterval: 30000,
});

server.on('connection', async (connection: WebSocketConnection, sessionId: string) => {
  // Handle connection
});
```

**WebSocketConnection Methods:**

```typescript
connection.sendAudio(audio: Buffer): void;
connection.sendEvent(event: any): void;
connection.sendError(code: string, message: string): void;
connection.close(): void;
```

**WebSocketConnection Events:**

```typescript
connection.on('audio-data', (data: Buffer) => {});
connection.on('message', (message: ClientMessage) => {});
connection.on('close', () => {});
connection.on('error', (error: Error) => {});
```

### WebRTCServer

```typescript
import { WebRTCServer } from '@tawk/voice-agents-sdk/core';

const server = new WebRTCServer({
  port: 8080,
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
});
```

---

## Providers

### STT Providers

Supported providers:
- **Deepgram** (`deepgram`)
- **AssemblyAI** (`assemblyai`)
- **OpenAI Whisper** (`openai`)

### TTS Providers

Supported providers:
- **ElevenLabs** (`elevenlabs`)
- **Cartesia** (`cartesia`)
- **OpenAI TTS** (`openai`)
- **Deepgram Aura** (`deepgram`)
- **Azure Neural TTS** (`azure`)

### VAD Providers

- **Energy-based VAD** (built-in)

---

## Complete Example

```typescript
import { VoiceAgent, WebSocketServer } from '@tawk/voice-agents-sdk/core';
import { tool, MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Define tools
const getWeather = tool({
  description: 'Get weather for a location',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return { temp: 72, condition: 'sunny' };
  },
});

// Create voice agent
const voiceAgent = new VoiceAgent({
  transport: { type: 'websocket' },
  
  stt: {
    provider: 'deepgram',
    apiKey: process.env.DEEPGRAM_API_KEY!,
  },
  
  agent: {
    model: openai('gpt-4o'),
    name: 'Assistant',
    instructions: 'You are helpful.',
    tools: { getWeather },
    session: new MemorySession('session-1'),
  },
  
  tts: {
    provider: 'elevenlabs',
    apiKey: process.env.ELEVENLABS_API_KEY!,
    voiceId: process.env.ELEVENLABS_VOICE_ID!,
  },
});

await voiceAgent.initialize();

// Handle events
voiceAgent.on('transcription', (text) => {
  console.log('User:', text);
});

voiceAgent.on('response.text', (text) => {
  console.log('Assistant:', text);
});

voiceAgent.on('audio.chunk', (chunk) => {
  // Send to client
});

// Process audio
await voiceAgent.processAudio(audioBuffer);

// Or process text
await voiceAgent.processText('What is the weather?');
```

---

## Type Definitions

### Message

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}
```

### ToolCall

```typescript
interface ToolCall {
  id: string;
  name: string;
  parameters: any;
}
```

### Metrics

```typescript
interface Metrics {
  totalLatency: number;
  sttLatency: number;
  llmLatency: number;
  ttsLatency: number;
  turns: number;
}
```

---

## How to Test

### Basic Testing

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';
import { MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';

describe('VoiceAgent API', () => {
  let voiceAgent: VoiceAgent;

  beforeEach(async () => {
    voiceAgent = new VoiceAgent({
      transport: { type: 'websocket' },
      stt: { provider: 'deepgram', apiKey: 'test-key' },
      agent: {
        model: openai('gpt-4o'),
        instructions: 'You are helpful.',
        session: new MemorySession('test-session'),
      },
      tts: { provider: 'elevenlabs', apiKey: 'test-key' },
    });
    await voiceAgent.initialize();
  });

  afterEach(async () => {
    await voiceAgent.stop();
  });

  it('should initialize successfully', () => {
    expect(voiceAgent).toBeDefined();
  });

  it('should process text input', async () => {
    const events: any[] = [];
    
    voiceAgent.on('response.text', (text) => {
      events.push({ type: 'response.text', text });
    });
    
    await voiceAgent.processText('Hello');
    
    expect(events.length).toBeGreaterThan(0);
  });

  it('should get metrics', () => {
    const metrics = voiceAgent.getMetrics();
    expect(metrics).toHaveProperty('totalLatency');
    expect(metrics).toHaveProperty('turns');
  });

  it('should handle errors', async () => {
    const errors: any[] = [];
    
    voiceAgent.on('error', (error) => {
      errors.push(error);
    });
    
    // Trigger an error scenario
    await voiceAgent.processText('test');
    
    // Verify error handling
  });
});
```

---

## See Also

- [Architecture Guide](./ARCHITECTURE.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [Tawk Agents SDK Integration](./AGENTS_SDK_INTEGRATION.md)
- [Multi-Modal Guide](./MULTI_MODAL_GUIDE.md)
