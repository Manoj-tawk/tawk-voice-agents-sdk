# Documentation

Complete documentation for Tawk Voice Agents SDK - a new SDK for building voice AI applications on top of Tawk Agents SDK.

## 📚 Documentation Index

### Getting Started

- **[Main README](../README.md)** - Overview, quick start, and installation
- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute
- **[Changelog](../CHANGELOG.md)** - Version history and bug fixes

### Core Documentation

- **[API Reference](./API.md)** ⭐ - Complete API documentation
- **[Architecture](./ARCHITECTURE.md)** - System design and architecture
- **[Project Structure](./PROJECT_STRUCTURE.md)** - Codebase organization

### Integration Guides

- **[Tawk Agents SDK Integration](./AGENTS_SDK_INTEGRATION.md)** - How Tawk Agents SDK powers the LLM layer
- **[Integration Guide](./INTEGRATION_GUIDE.md)** - MediaSoup, Twilio, telephony integration
- **[Multi-Modal Guide](./MULTI_MODAL_GUIDE.md)** - Audio + Text input/output handling

### Comparison & Analysis

- **[Market Comparison](./MARKET_COMPARISON.md)** - vs OpenAI Realtime API and others

---

## 🚀 Quick Navigation

### For First-Time Users

1. Start with [Main README](../README.md) for overview
2. Check [Quick Start](../README.md#quick-start) for setup
3. Try [Basic Example](../examples/README.md)
4. Read [API Reference](./API.md) for detailed usage

### For Developers

1. Read [Architecture](./ARCHITECTURE.md) to understand the system
2. Check [API Reference](./API.md) for detailed API docs
3. Review [Project Structure](./PROJECT_STRUCTURE.md) for codebase layout
4. See [Contributing Guide](../CONTRIBUTING.md) for development workflow

### For Integration

1. Check [Integration Guide](./INTEGRATION_GUIDE.md) for your use case
2. Review [Multi-Modal Guide](./MULTI_MODAL_GUIDE.md) for input/output handling
3. See [Tawk Agents SDK Integration](./AGENTS_SDK_INTEGRATION.md) for agent configuration

---

## 📖 Documentation by Topic

### What is Tawk Voice Agents SDK?

Tawk Voice Agents SDK is a **new SDK for building voice AI applications**. It's built on top of **Tawk Agents SDK** and adds:

- **Speech-to-Text (STT)** - Convert audio to text
- **Text-to-Speech (TTS)** - Convert text to audio
- **Transport Layer** - WebSocket and WebRTC server-to-server communication
- **Voice-specific features** - VAD, interruption handling, audio buffering

### Core Concepts

#### Multi-Modal Input & Dual Output

```
INPUT:  Audio OR Text
OUTPUT: ALWAYS Audio + Text
```

The SDK supports both audio and text input, and always generates both text and audio output.

See: [Multi-Modal Guide](./MULTI_MODAL_GUIDE.md)

---

#### Built on Tawk Agents SDK

Tawk Voice Agents SDK is built on top of **Tawk Agents SDK**, which provides:

- LLM orchestration with any AI model
- Tool calling and function execution
- Multi-agent handoffs
- Guardrails and safety checks
- Session and memory management
- Observability and tracing

See: [Tawk Agents SDK Integration](./AGENTS_SDK_INTEGRATION.md)

---

#### Provider Architecture

- **STT**: Deepgram, OpenAI, AssemblyAI
- **TTS**: ElevenLabs, Cartesia, OpenAI, Deepgram, Azure
- **LLM**: Any model via Tawk Agents SDK (OpenAI, Anthropic, Google, etc.)

See: [Architecture](./ARCHITECTURE.md)

---

### Features

#### Tool Calling

```typescript
import { tool } from '@tawk/voice-agents-sdk/core';

const getTool = tool({
  description: 'Tool description',
  parameters: schema,
  execute: async (args) => { /* ... */ },
});
```

See: [API Reference - Tools](./API.md#with-tools)

---

#### Session Management

```typescript
import { MemorySession } from '@tawk/voice-agents-sdk/core';

const session = new MemorySession('user-id');
// Maintains conversation history automatically
```

See: [API Reference - Sessions](./API.md#with-session-management)

---

#### Multi-Agent Handoffs

```typescript
const supportAgent = new Agent({ /* ... */ });
const billingAgent = new Agent({ /* ... */ });

const coordinator = new Agent({
  name: 'Coordinator',
  handoffs: [supportAgent, billingAgent],
});
```

See: [Tawk Agents SDK Integration](./AGENTS_SDK_INTEGRATION.md)

---

#### Guardrails

```typescript
import { guardrails } from '@tawk/voice-agents-sdk/core';

const agent = new Agent({
  guardrails: [
    guardrails.contentSafety(),
    guardrails.piiDetection(),
  ],
});
```

See: [Tawk Agents SDK Integration](./AGENTS_SDK_INTEGRATION.md)

---

### How to Use

#### Basic Usage

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';
import { MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';

const voiceAgent = new VoiceAgent({
  transport: { type: 'websocket' },
  stt: { provider: 'deepgram', apiKey: '...' },
  agent: {
    model: openai('gpt-4o'),
    instructions: 'You are helpful.',
    session: new MemorySession('session-id'),
  },
  tts: { provider: 'elevenlabs', apiKey: '...' },
});

await voiceAgent.initialize();
await voiceAgent.processAudio(audioBuffer);
```

See: [API Reference](./API.md) for complete examples.

---

### How to Test

#### Unit Testing

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';

describe('VoiceAgent', () => {
  it('should process audio', async () => {
    const agent = new VoiceAgent({ /* config */ });
    await agent.initialize();
    await agent.processAudio(audioBuffer);
    // Assert events
  });
});
```

#### Integration Testing

```typescript
import { WebSocketServer } from '@tawk/voice-agents-sdk/core';

describe('WebSocket Integration', () => {
  it('should handle WebSocket connections', async () => {
    const server = new WebSocketServer({ port: 8080 });
    // Test connection handling
  });
});
```

See: [Project Structure](./PROJECT_STRUCTURE.md) for test organization.

---

### Integration Examples

#### MediaSoup

```typescript
const agent = new VoiceAgent({
  transport: { type: 'webrtc' },
  // ... config
});
```

See: [Integration Guide](./INTEGRATION_GUIDE.md)

---

#### Twilio

```typescript
connection.on('media', async (payload) => {
  const audio = Buffer.from(payload.media.payload, 'base64');
  await agent.processAudio(audio);
});
```

See: [Integration Guide](./INTEGRATION_GUIDE.md)

---

### Performance & Optimization

#### Latency Breakdown

| Component | Latency |
|-----------|---------|
| STT | ~200ms |
| LLM | ~500-1000ms |
| TTS | ~150-300ms |
| **Total** | **~800ms - 1.5s** |

See: [API Reference - Performance](./API.md#performance)

---

#### Cost Comparison

| Solution | Cost/min |
|----------|----------|
| Tawk Voice Agents SDK | **$0.009** |
| OpenAI Realtime | $0.30 |
| **Savings** | **33x cheaper** |

See: [Market Comparison](./MARKET_COMPARISON.md)

---

## 🔧 Troubleshooting

### Common Issues

**Audio not transcribing?**
- Check STT provider API key
- Ensure audio format is PCM16, 16kHz, mono
- Enable debug logging: `logging: { level: 'debug' }`

**No audio output?**
- Check TTS provider API key
- Verify voiceId is valid
- Check `audio.chunk` event listener

**Session not persisting?**
- Use MemorySession or RedisSession
- Ensure session is passed to agent config

**High latency?**
- Use Cartesia for TTS (~150ms)
- Use streaming: `streaming: true`
- Enable interruption: `interruption: { enabled: true }`

See: [API Reference](./API.md) for detailed docs

---

## 📦 Package Structure

```
tawk-voice-agents-sdk/
├── src/              # Source code
├── examples/         # Usage examples
├── docs/             # Documentation (you are here!)
├── tests/            # Test files
└── dist/             # Build output
```

See: [Project Structure](./PROJECT_STRUCTURE.md) for details

---

## 🤝 Contributing

Want to improve the documentation?

1. Check [Contributing Guide](../CONTRIBUTING.md)
2. Submit a PR with your improvements
3. Documentation PRs are always welcome!

---

## 📮 Support

- 📧 **Email**: support@tawk.to
- 💬 **Issues**: [GitHub Issues](https://github.com/tawk/tawk-voice-agents-sdk/issues)
- 📚 **Docs**: [Full Documentation](./README.md)

---

## 📝 License

MIT License - see [LICENSE](../LICENSE) file for details.

---

<div align="center">

**Made with ❤️ by Tawk for voice AI developers**

[⭐ Star us on GitHub](https://github.com/tawk/tawk-voice-agents-sdk)

</div>
