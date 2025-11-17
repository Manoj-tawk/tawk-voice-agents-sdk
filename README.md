# Tawk Voice Agents SDK 🎙️

**A new SDK for building voice AI applications** with WebSocket & WebRTC server-to-server support. Built on top of Tawk Agents SDK, it provides complete **Multi-Modal** (Audio + Text) input with **ALWAYS Dual Output** (Text + Audio).

```
INPUT:  Audio OR Text
OUTPUT: ALWAYS Audio + Text
```

STT → **Tawk Agents SDK** → TTS pipeline for MediaSoup and telephony integration.

[![npm version](https://badge.fury.io/js/%40tawk%2Fvoice-agents-sdk.svg)](https://www.npmjs.com/package/@tawk/voice-agents-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

---

## 💡 Core Concept

### Multi-Modal Input, Dual Output

```
INPUT MODES:
1. Audio → STT → Tawk Agents SDK → TTS → Audio + Text
2. Text →        Tawk Agents SDK → TTS → Audio + Text

OUTPUT: ALWAYS both Text AND Audio
```

**Built on Tawk Agents SDK** - The Tawk Voice Agents SDK wraps:
- **STT** (Speech-to-Text) - for audio input
- **Tawk Agents SDK** (Complete LLM orchestration with tools, handoffs, guardrails)
- **TTS** (Text-to-Speech) - ALWAYS generates audio output

Into a production-ready voice pipeline.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🎤 **Multi-Modal Input** | Audio (via STT) OR Text input |
| 🔊 **Dual Output** | ALWAYS generates both Text AND Audio |
| 🔌 **Dual Transport** | WebSocket & WebRTC server-to-server |
| 🤖 **Tawk Agents SDK = LLM** | Full agent orchestration (tools, handoffs, guardrails) IS the LLM layer |
| 🎯 **Multi-Provider** | STT: Deepgram/OpenAI/AssemblyAI • TTS: ElevenLabs/Cartesia/OpenAI/Azure |
| 📡 **Enhanced Events** | OpenAI Realtime-style event system |
| ⚡ **Low Latency** | <800ms end-to-end response time |
| 🛠️ **Tool Calling** | Built-in via Tawk Agents SDK |
| 🛡️ **Guardrails** | Content safety & PII detection via Tawk Agents SDK |
| 📊 **Tracing** | Langfuse observability built-in |
| 💰 **Cost-Effective** | $0.009/min vs OpenAI Realtime $0.30/min (33x cheaper!) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Your Application / Media Server                 │
│         (Twilio, MediaSoup, Contact Center, etc.)           │
└──────────────────────┬──────────────────────────────────────┘
                       │ WebSocket / WebRTC
┌──────────────────────▼──────────────────────────────────────┐
│                  Voice Agent SDK                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Transport Layer                            │   │
│  │  - WebSocket Server  - WebRTC Server                 │   │
│  │  - Session Management  - Event System                │   │
│  └─────────────────────┬────────────────────────────────┘   │
│                        │                                     │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │         Voice Agent (Pipeline Orchestrator)           │   │
│  │  Audio In → STT → Tawk Agents SDK → TTS → Audio Out │   │
│  └──┬─────────────────┬─────────────────┬──────────────┘   │
│     │                 │                 │                   │
│  ┌──▼────┐     ┌──────▼──────────────┐  ┌──▼────┐            │
│  │  STT  │  →  │ Tawk Agents SDK     │→ │  TTS  │            │
│  │Provider     │ (LLM LAYER)        │  │Provider            │
│  └───────┘     │                     │  └───────┘            │
│                │ • Tools             │                        │
│                │ • Handoffs          │                        │
│                │ • Guardrails        │                        │
│                │ • Sessions          │                        │
│                │ • Tracing           │                        │
│                └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

**Key:** Tawk Agents SDK provides the LLM orchestration layer, giving you full agent capabilities.

---

## 🚀 Quick Start

### Installation

```bash
npm install @tawk/voice-agents-sdk
```

### Basic Server

```typescript
import { WebSocketServer, VoiceAgent } from '@tawk/voice-agents-sdk/core';
import { tool } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Define tools (using Tawk Agents SDK)
const getWeather = tool({
  description: 'Get weather for a location',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return { temp: 72, condition: 'sunny' };
  },
});

// Setup WebSocket server
const wsServer = new WebSocketServer({
  port: 8080,
  apiKeys: [process.env.API_KEY],
});

wsServer.on('connection', async (sessionId, connection) => {
  // Create voice agent powered by Tawk Agents SDK
  const voiceAgent = new VoiceAgent({
    transport: { type: 'websocket' },
    
    stt: {
      provider: 'deepgram',
      apiKey: process.env.DEEPGRAM_API_KEY!,
    },
    
    // Configure the agent using Tawk Agents SDK
    agent: {
      model: openai('gpt-4o'),
      name: 'VoiceAssistant',
      instructions: 'You are a helpful voice assistant. Keep responses brief.',
      
      // Tawk Agents SDK features:
      tools: { getWeather },
      // handoffs: [otherAgents],
      // guardrails: [...],
      
      modelSettings: {
        temperature: 0.7,
        maxTokens: 150,
      },
    },
    
    tts: {
      provider: 'elevenlabs',
      apiKey: process.env.ELEVENLABS_API_KEY!,
      voiceId: process.env.ELEVENLABS_VOICE_ID!,
    },
    
    vad: { enabled: true },
    interruption: { enabled: true },
  });

  await voiceAgent.initialize();
  
  // Handle incoming audio from MediaSoup
  connection.on('audio-data', async (audio: Buffer) => {
    await voiceAgent.processAudio(audio);
  });
  
  // Send audio back to MediaSoup
  voiceAgent.on('audio.chunk', (chunk: Buffer) => {
    connection.sendAudio(chunk);
  });
  
  // Send events to client
  voiceAgent.on('transcription', (text) => {
    connection.sendEvent({ type: 'transcription', text });
  });
  
  voiceAgent.on('tool.call', (toolCall) => {
    console.log('Tool called:', toolCall.name);
  });
});

console.log('Voice Agent Server running on ws://localhost:8080');
```

### Key Points

1. **Tawk Agents SDK powers the LLM layer** - configure agents directly in `agent: { }`
2. **Full agent features** - tools, handoffs, guardrails, sessions built-in
3. **Multi-modal input** - handle both audio and text seamlessly
4. **Always dual output** - get both text and audio responses
5. **Production-ready** - perfect for MediaSoup, telephony, and server-to-server integrations

### With Tools

```typescript
import { Agent, tool } from '@tawk/voice-agents-sdk/core';
import { z } from 'zod';

const getWeather = tool({
  description: 'Get current weather for a location',
  parameters: z.object({
    location: z.string().describe('City name'),
  }),
  execute: async ({ location }) => {
    // Call your weather API
    return {
      location,
      temperature: 22,
      condition: 'Sunny',
    };
  },
});

const agent = new Agent({
  name: 'WeatherAssistant',
  model: openai('gpt-4o'),
  instructions: 'You help users check the weather.',
  tools: { getWeather },
});
```

### With Guardrails

```typescript
import { Agent, guardrails } from '@tawk/voice-agents-sdk/core';

const agent = new Agent({
  name: 'SafeAssistant',
  model: openai('gpt-4o'),
  instructions: 'You are a helpful assistant.',
  guardrails: [
    // Content safety
    guardrails.contentSafety({
      type: 'output',
      provider: 'openai',
      threshold: 0.8,
    }),
    
    // PII detection
    guardrails.piiDetection({
      type: 'output',
      action: 'redact',
    }),
    
    // Length validation
    guardrails.length({
      type: 'output',
      maxLength: 500,
      unit: 'words',
    }),
  ],
});
```

### Multi-Agent Handoffs

```typescript
import { Agent, Handoff } from '@tawk/voice-agents-sdk/core';

const supportAgent = new Agent({
  name: 'Support',
  model: openai('gpt-4o'),
  instructions: 'You handle general customer support.',
});

const billingAgent = new Agent({
  name: 'Billing',
  model: openai('gpt-4o'),
  instructions: 'You handle billing and payment issues.',
});

const coordinator = new Agent({
  name: 'Coordinator',
  model: openai('gpt-4o'),
  instructions: 'You coordinate customer inquiries and delegate to specialists.',
  handoffs: [supportAgent, billingAgent],
});

// Automatically routes to the right agent
const result = await run(coordinator, 'I need help with my invoice');
```

---

## 📖 Supported Providers

### Speech-to-Text (STT)
- ✅ **Deepgram** Nova-2 (recommended, ~200ms latency)
- ✅ **AssemblyAI** Universal Streaming
- ✅ **OpenAI** Whisper

### Language Models (via Tawk Agents SDK)
- ✅ **OpenAI** GPT-4o, GPT-4o-mini
- ✅ **Anthropic** Claude 3.5 Sonnet
- ✅ **Google** Gemini 2.0 Flash
- ✅ **Groq** Llama 3.1 (ultra-fast, 300+ tokens/sec)
- ✅ **Any Vercel AI SDK provider**

### Text-to-Speech (TTS)
- ✅ **ElevenLabs** Turbo v2.5 (recommended, best quality)
- ✅ **Cartesia** Sonic (fastest, ~150ms latency)
- ✅ **OpenAI** TTS
- ✅ **Deepgram** Aura-2
- ✅ **Azure** Neural TTS

---

## 🎯 Use Cases

- **Contact Centers** - Intelligent IVR, call routing, agent assist
- **Voice Assistants** - Custom voice apps with your own agents
- **Telephony Integration** - Twilio, Vonage, telephony systems
- **Media Servers** - MediaSoup, Janus, Jitsi integration
- **Customer Service** - Automated support with handoffs to humans
- **Voice Gateways** - Server-to-server voice processing

---

## 📊 Enhanced Event System

OpenAI Realtime-style events for complete observability:

```typescript
// Session events
voiceAgent.on('session.created', (session) => { ... });

// Audio events
voiceAgent.on('audio.input.started', (event) => { ... });
voiceAgent.on('audio.output.started', (event) => { ... });

// Transcription events
voiceAgent.on('transcription.delta', (event) => { ... });
voiceAgent.on('transcription.done', (event) => { ... });

// Response events
voiceAgent.on('response.text.delta', (event) => { ... });
voiceAgent.on('response.audio.delta', (event) => { ... });
voiceAgent.on('response.tool.call', (event) => { ... });
voiceAgent.on('response.done', (event) => { ... });

// Error events
voiceAgent.on('error', (error) => { ... });
```

---

## 🔧 Configuration

### Environment Variables

```bash
# STT
DEEPGRAM_API_KEY=your-key
ASSEMBLYAI_API_KEY=your-key

# LLM (Tawk Agents SDK / Vercel AI SDK)
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
GOOGLE_API_KEY=your-key
GROQ_API_KEY=your-key

# TTS
ELEVENLABS_API_KEY=your-key
CARTESIA_API_KEY=your-key
AZURE_API_KEY=your-key

# Tracing (Optional)
LANGFUSE_PUBLIC_KEY=your-key
LANGFUSE_SECRET_KEY=your-key
LANGFUSE_HOST=https://cloud.langfuse.com
```

### Voice Agent Configuration

```typescript
const config: VoiceAgentConfig = {
  stt: {
    provider: 'deepgram',
    apiKey: process.env.DEEPGRAM_API_KEY,
    model: 'nova-2',
    language: 'en-US',
    streaming: true,
  },
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o',
    temperature: 0.7,
    systemPrompt: 'You are a helpful assistant.',
  },
  tts: {
    provider: 'elevenlabs',
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: 'your-voice-id',
    model: 'turbo-v2.5',
    streaming: true,
  },
  vad: {
    enabled: true,
    provider: 'energy',
    threshold: 0.5,
  },
  interruption: {
    enabled: true,
  },
  logging: {
    level: 'info',
    enableMetrics: true,
  },
};
```

---

## 📚 Documentation

### Core Docs
- **[📖 Documentation Index](./docs/README.md)** - Complete documentation hub
- **[🔧 API Reference](./docs/API.md)** - Complete API documentation
- **[🏗️ Architecture](./docs/ARCHITECTURE.md)** - System design and architecture
- **[📁 Project Structure](./docs/PROJECT_STRUCTURE.md)** - Codebase organization

### Integration Guides
- **[🤖 Tawk Agents SDK Integration](./docs/AGENTS_SDK_INTEGRATION.md)** - Using Tawk Agents SDK as LLM layer
- **[🔌 Integration Guide](./docs/INTEGRATION_GUIDE.md)** - MediaSoup, Twilio, telephony
- **[🎙️ Multi-Modal Guide](./docs/MULTI_MODAL_GUIDE.md)** - Audio + Text input/output

### Comparison
- **[📊 Market Comparison](./docs/MARKET_COMPARISON.md)** - vs OpenAI Realtime API

### Examples
- **[💡 Usage Examples](./examples/README.md)** - Production-ready examples

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Test individual providers
npm run test:providers

# Test integration
npm run test:integration
```

---

## 🚀 Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["node", "dist/server/index.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  voice-agent:
    build: .
    ports:
      - "8080:8080"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}
      - ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}
    restart: unless-stopped
```

---

## 💡 Why Tawk Voice Agents SDK?

Tawk Voice Agents SDK is a new SDK designed specifically for building voice AI applications. Here's what makes it unique:

### Key Advantages

✅ **Built on Tawk Agents SDK** - Full agent capabilities (tools, handoffs, guardrails)  
✅ **Multi-modal input** - Handle both audio and text seamlessly  
✅ **Always dual output** - Get both text and audio responses  
✅ **Multi-provider support** - No vendor lock-in, switch providers easily  
✅ **Production-ready** - Guardrails, tracing, error handling built-in  
✅ **Server-to-server** - Built for media servers, telephony, and WebRTC  
✅ **Cost-effective** - 33x cheaper than OpenAI Realtime  
✅ **Open source** - Full control and customization

### vs OpenAI Realtime API

| Feature | Tawk Voice Agents SDK | OpenAI Realtime |
|---------|-----------------|-----------------|
| **Cost** | $0.009/min | $0.30/min |
| **Provider Choice** | Multiple (Deepgram, ElevenLabs, etc.) | OpenAI only |
| **Agent Framework** | Built on Tawk Agents SDK | Basic |
| **Transport** | WebSocket + WebRTC | WebSocket only |
| **Server-to-Server** | ✅ First-class | ❌ Browser-focused |
| **Multi-Agent** | ✅ Full support | ❌ Limited |
| **Observability** | ✅ Langfuse tracing | ❌ Basic logs |  

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

---

## 📝 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:
- **[Tawk Agents SDK](https://github.com/tawk/tawk-agents-sdk)** - Agent orchestration framework
- **[Vercel AI SDK](https://sdk.vercel.ai/)** - Multi-provider LLM interface
- **[Langfuse](https://langfuse.com/)** - LLM observability

---

## 📮 Support

- 📧 **Email**: support@tawk.to
- 💬 **Issues**: [GitHub Issues](https://github.com/tawk/tawk-voice-agents-sdk/issues)
- 📚 **Documentation**: [Full Documentation](./docs/)

---

<div align="center">

**Made with ❤️ by Tawk for voice AI developers**

[⭐ Star us on GitHub](https://github.com/tawk/tawk-voice-agents-sdk) • [📦 View on NPM](https://www.npmjs.com/package/@tawk/voice-agents-sdk)

</div>
