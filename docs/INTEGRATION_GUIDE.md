# Tawk Voice Agents SDK - Integration Guide

Complete guide for integrating Tawk Voice Agents SDK into your application. Learn how to use this new SDK for building voice AI applications on top of Tawk Agents SDK.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [WebSocket Integration](#websocket-integration)
- [WebRTC Integration](#webrtc-integration)
- [MediaSoup Integration](#mediasoup-integration)
- [Telephony Integration](#telephony-integration)
- [Complete Examples](#complete-examples)

---

## Quick Start

### Basic Setup

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';
import { tool, MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// 1. Define tools (optional)
const getWeather = tool({
  description: 'Get weather for a location',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return { temp: 72, condition: 'sunny' };
  },
});

// 2. Create voice agent
const voiceAgent = new VoiceAgent({
  transport: {
    type: 'websocket',
  },
  
  stt: {
    provider: 'deepgram',
    apiKey: process.env.DEEPGRAM_API_KEY!,
    model: 'nova-2',
  },
  
  agent: {
    model: openai('gpt-4o'),
    name: 'VoiceAssistant',
    instructions: 'You are a helpful voice assistant.',
    tools: { getWeather },
    session: new MemorySession('session-id'),
  },
  
  tts: {
    provider: 'elevenlabs',
    apiKey: process.env.ELEVENLABS_API_KEY!,
    voiceId: process.env.ELEVENLABS_VOICE_ID!,
  },
});

// 3. Initialize
await voiceAgent.initialize();

// 4. Handle events
voiceAgent.on('transcription', (text) => {
  console.log('User:', text);
});

voiceAgent.on('response.text', (text) => {
  console.log('Assistant:', text);
});

voiceAgent.on('audio.chunk', (chunk) => {
  // Send audio to client
});

// 5. Process input
await voiceAgent.processAudio(audioBuffer);
// or
await voiceAgent.processText('Hello!');
```

---

## Architecture Overview

### Pipeline Flow

The Tawk Voice Agents SDK is built on a clean, layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                         │
│         (MediaSoup, Telephony, WebSocket, etc.)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Transport Layer                                 │
│         WebSocket Server / WebRTC Server                    │
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
│                    └─────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### How It Works

1. **Tawk Agents SDK powers the LLM layer** - Configure agents directly in `agent: { }`
2. **Multi-modal input** - Handle both audio (via STT) and text input seamlessly
3. **Dual output** - Always generates both text and audio responses
4. **Event-driven** - Use events to handle responses and integrate with your application

---

## WebSocket Integration

### Server Setup

```typescript
import { WebSocketServer, WebSocketConnection } from '@tawk/voice-agents-sdk/core';
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';
import { tool, MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';

// Create WebSocket server
const wsServer = new WebSocketServer({
  port: 8080,
  apiKeys: [process.env.API_KEY],
});

// Handle connections
wsServer.on('connection', async (connection: WebSocketConnection, sessionId: string) => {
  console.log(`[${sessionId}] New connection`);
  
  // Create voice agent for this session
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
      session: new MemorySession(sessionId),
    },
    
    tts: {
      provider: 'elevenlabs',
      apiKey: process.env.ELEVENLABS_API_KEY!,
      voiceId: process.env.ELEVENLABS_VOICE_ID!,
    },
  });
  
  await voiceAgent.initialize();
  
  // Handle incoming audio
  connection.on('audio-data', async (audio: Buffer) => {
    await voiceAgent.processAudio(audio);
  });
  
  // Handle incoming messages
  connection.on('message', async (message: any) => {
    if (message.type === 'text') {
      await voiceAgent.processText(message.text);
    } else if (message.type === 'interrupt') {
      await voiceAgent.interrupt();
    }
  });
  
  // Send audio back to client
  voiceAgent.on('audio.chunk', (chunk: Buffer) => {
    connection.sendAudio(chunk);
  });
  
  // Send events to client
  voiceAgent.on('transcription', (text: string) => {
    connection.sendEvent({
      type: 'transcription',
      text,
    });
  });
  
  voiceAgent.on('response.text.delta', (delta: string) => {
    connection.sendEvent({
      type: 'response.text.delta',
      text: delta,
    });
  });
  
  voiceAgent.on('response.text', (text: string) => {
    connection.sendEvent({
      type: 'response.text',
      text,
    });
  });
  
  voiceAgent.on('tool.call', (toolCall: any) => {
    connection.sendEvent({
      type: 'tool.call',
      tool: toolCall.name,
      params: toolCall.parameters,
      result: toolCall.result,
    });
  });
  
  voiceAgent.on('error', (error: Error) => {
    connection.sendError('error', error.message);
  });
  
  // Handle disconnection
  connection.on('close', async () => {
    await voiceAgent.stop();
  });
});

console.log('WebSocket server running on ws://localhost:8080');
```

### Client Example (Browser)

```typescript
const ws = new WebSocket('ws://localhost:8080');

// Send audio
const audioContext = new AudioContext();
const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
const source = audioContext.createMediaStreamSource(mediaStream);
const processor = audioContext.createScriptProcessor(4096, 1, 1);

processor.onaudioprocess = (e) => {
  const audioData = e.inputBuffer.getChannelData(0);
  const buffer = new Int16Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    buffer[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
  }
  ws.send(buffer.buffer);
};

source.connect(processor);
processor.connect(audioContext.destination);

// Send text
ws.send(JSON.stringify({
  type: 'text',
  text: 'Hello!',
}));

// Receive audio
const audioContext2 = new AudioContext();
ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    // Play audio
    const audioBuffer = audioContext2.createBuffer(1, event.data.byteLength / 2, 16000);
    const channelData = audioBuffer.getChannelData(0);
    const view = new Int16Array(event.data);
    for (let i = 0; i < view.length; i++) {
      channelData[i] = view[i] / 32768;
    }
    const source = audioContext2.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext2.destination);
    source.start();
  } else {
    // Handle events
    const message = JSON.parse(event.data);
    console.log(message);
  }
};
```

---

## WebRTC Integration

```typescript
import { WebRTCServer } from '@tawk/voice-agents-sdk/core';
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';

const rtcServer = new WebRTCServer({
  port: 8080,
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
});

rtcServer.on('connection', async (connection, sessionId) => {
  const voiceAgent = new VoiceAgent({
    transport: { type: 'webrtc' },
    // ... config
  });
  
  await voiceAgent.initialize();
  
  // Handle RTC audio stream
  connection.on('audio-stream', async (stream) => {
    for await (const chunk of stream) {
      await voiceAgent.processAudio(chunk);
    }
  });
  
  // Send audio back
  voiceAgent.on('audio.chunk', (chunk) => {
    connection.sendAudio(chunk);
  });
});
```

---

## MediaSoup Integration

MediaSoup is a WebRTC media server. Here's how to integrate:

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';
import mediasoup from 'mediasoup';

// Create MediaSoup worker
const worker = await mediasoup.createWorker({
  logLevel: 'warn',
  rtcMinPort: 40000,
  rtcMaxPort: 49999,
});

// Create router
const router = await worker.createRouter({
  mediaCodecs: [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
  ],
});

// Create transport
const transport = await router.createWebRtcTransport({
  listenIps: [{ ip: '0.0.0.0', announcedIp: 'your-ip' }],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
});

// Create voice agent
const voiceAgent = new VoiceAgent({
  transport: {
    type: 'mediasoup',
    mediasoup: {
      router,
      transport,
    },
  },
  // ... rest of config
});

await voiceAgent.initialize();

// Handle producer (incoming audio)
transport.on('produce', async ({ kind, rtpParameters }, callback) => {
  if (kind === 'audio') {
    const producer = await transport.produce({ kind, rtpParameters });
    
    // Convert RTP to audio buffer and process
    producer.on('transportclose', () => {
      voiceAgent.stop();
    });
    
    // Process audio from producer
    // (You'll need to convert RTP packets to audio buffers)
  }
});

// Handle consumer (outgoing audio)
// Create consumer and send audio chunks
voiceAgent.on('audio.chunk', async (chunk) => {
  // Convert audio buffer to RTP and send via consumer
});
```

---

## Telephony Integration

### Twilio Integration

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';
import twilio from 'twilio';

const voiceResponse = twilio.twiml.VoiceResponse();

// Create voice agent
const voiceAgent = new VoiceAgent({
  transport: { type: 'websocket' },
  // ... config
});

await voiceAgent.initialize();

// Twilio webhook handler
app.post('/voice', (req, res) => {
  const response = new twilio.twiml.VoiceResponse();
  
  // Connect to WebSocket endpoint
  response.connect({
    action: '/handle-call',
  });
  
  res.type('text/xml');
  res.send(response.toString());
});

// Handle call
app.post('/handle-call', async (req, res) => {
  const callSid = req.body.CallSid;
  
  // Create WebSocket connection to voice agent server
  const ws = new WebSocket('ws://your-voice-agent-server:8080');
  
  // Convert Twilio audio to format expected by voice agent
  // Twilio sends μ-law audio, convert to PCM16
  ws.on('open', () => {
    // Handle Twilio media stream
    app.post(`/media/${callSid}`, (req, res) => {
      const audio = Buffer.from(req.body.payload, 'base64');
      // Convert μ-law to PCM16
      const pcm16 = convertMulawToPCM16(audio);
      ws.send(pcm16);
    });
  });
  
  // Send audio back to Twilio
  voiceAgent.on('audio.chunk', (chunk) => {
    // Convert PCM16 to μ-law
    const mulaw = convertPCM16ToMulaw(chunk);
    // Send to Twilio
    res.write(mulaw.toString('base64'));
  });
});
```

---

## Complete Examples

### Example 1: Basic WebSocket Server

```typescript
import { WebSocketServer } from '@tawk/voice-agents-sdk/core';
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';
import { MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';

const wsServer = new WebSocketServer({ port: 8080 });

wsServer.on('connection', async (connection, sessionId) => {
  const voiceAgent = new VoiceAgent({
    transport: { type: 'websocket' },
    stt: {
      provider: 'deepgram',
      apiKey: process.env.DEEPGRAM_API_KEY!,
    },
    agent: {
      model: openai('gpt-4o'),
      instructions: 'You are helpful.',
      session: new MemorySession(sessionId),
    },
    tts: {
      provider: 'elevenlabs',
      apiKey: process.env.ELEVENLABS_API_KEY!,
      voiceId: process.env.ELEVENLABS_VOICE_ID!,
    },
  });
  
  await voiceAgent.initialize();
  
  connection.on('audio-data', async (audio) => {
    await voiceAgent.processAudio(audio);
  });
  
  voiceAgent.on('audio.chunk', (chunk) => {
    connection.sendAudio(chunk);
  });
  
  voiceAgent.on('response.text', (text) => {
    connection.sendEvent({ type: 'response.text', text });
  });
});
```

### Example 2: With Tools

```typescript
import { tool } from '@tawk/voice-agents-sdk/core';
import { z } from 'zod';

const getWeather = tool({
  description: 'Get weather',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return { temp: 72, condition: 'sunny' };
  },
});

const voiceAgent = new VoiceAgent({
  // ... config
  agent: {
    // ... agent config
    tools: { getWeather },
  },
});
```

### Example 3: With Multi-Agent Handoffs

```typescript
import { Agent } from '@tawk/voice-agents-sdk/core';

const supportAgent = new Agent({
  name: 'Support',
  model: openai('gpt-4o'),
  instructions: 'Handle support questions.',
});

const billingAgent = new Agent({
  name: 'Billing',
  model: openai('gpt-4o'),
  instructions: 'Handle billing questions.',
});

const coordinator = new Agent({
  name: 'Coordinator',
  model: openai('gpt-4o'),
  instructions: 'Route to specialists.',
  handoffs: [supportAgent, billingAgent],
});

const voiceAgent = new VoiceAgent({
  // ... config
  agent: coordinator,
});
```

---

## How to Test

### Unit Testing

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';
import { MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';

describe('VoiceAgent', () => {
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

  it('should process text input', async () => {
    const events: any[] = [];
    
    voiceAgent.on('response.text', (text) => {
      events.push({ type: 'response.text', text });
    });
    
    await voiceAgent.processText('Hello');
    
    expect(events).toHaveLength(1);
    expect(events[0].text).toBeTruthy();
  });

  it('should emit audio chunks', async () => {
    const chunks: Buffer[] = [];
    
    voiceAgent.on('audio.chunk', (chunk) => {
      chunks.push(chunk);
    });
    
    await voiceAgent.processText('Hello');
    
    expect(chunks.length).toBeGreaterThan(0);
  });
});
```

### Integration Testing

```typescript
import { WebSocketServer } from '@tawk/voice-agents-sdk/core';

describe('WebSocket Integration', () => {
  let server: WebSocketServer;

  beforeEach(() => {
    server = new WebSocketServer({ port: 8080 });
  });

  afterEach(async () => {
    await server.close();
  });

  it('should handle WebSocket connections', async () => {
    const connectionPromise = new Promise((resolve) => {
      server.on('connection', (connection, sessionId) => {
        resolve({ connection, sessionId });
      });
    });

    // Connect client
    const ws = new WebSocket('ws://localhost:8080');
    
    const { connection, sessionId } = await connectionPromise;
    expect(sessionId).toBeTruthy();
  });
});
```

### Testing with Tools

```typescript
import { tool } from '@tawk/voice-agents-sdk/core';

const mockGetWeather = tool({
  description: 'Get weather',
  parameters: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    return { temp: 72, condition: 'sunny' };
  },
});

it('should call tools', async () => {
  const toolCalls: any[] = [];
  
  voiceAgent.on('tool.call', (call) => {
    toolCalls.push(call);
  });
  
  await voiceAgent.processText('What is the weather in Tokyo?');
  
  expect(toolCalls.length).toBeGreaterThan(0);
  expect(toolCalls[0].name).toBe('getWeather');
});
```

---

## Best Practices

1. **Session Management**: Use `MemorySession` for development, `RedisSession` for production
2. **Error Handling**: Always listen to `error` events
3. **Resource Cleanup**: Call `stop()` when done
4. **Audio Format**: Use PCM16, 16kHz, mono for best compatibility
5. **Debouncing**: VoiceAgent handles debouncing automatically (500ms)
6. **Interruption**: Enable interruption for better UX
7. **Testing**: Write tests for your voice agents and integrations

---

## Troubleshooting

### Audio Not Processing

- Check STT provider API key
- Verify audio format (PCM16, 16kHz, mono)
- Enable debug logging: `logging: { level: 'debug' }`

### No Audio Output

- Check TTS provider API key
- Verify voiceId is valid
- Ensure `audio.chunk` event listener is set up

### High Latency

- Use streaming providers
- Enable interruption
- Use faster TTS providers (Cartesia is fastest)

---

## See Also

- [API Reference](./API.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [Tawk Agents SDK Integration](./AGENTS_SDK_INTEGRATION.md)
