# Tawk Agents SDK Integration

Complete guide to how Tawk Voice Agents SDK uses Tawk Agents SDK for LLM orchestration.

## Overview

**Tawk Voice Agents SDK** is a new SDK for building voice AI applications. It's built on top of **Tawk Agents SDK**, which provides the complete LLM orchestration layer. This integration gives you full access to advanced agent capabilities including tools, multi-agent handoffs, guardrails, and session management.

```
Voice Agent = STT + Tawk Agents SDK + TTS
              ^^^   ^^^^^^^^^^^^^^^^^^^   ^^^
              |         |                  |
           Speech   LLM Layer          Speech
           Input    (agents)           Output
```

---

## Architecture

Tawk Voice Agents SDK is designed around Tawk Agents SDK as the core LLM orchestration layer:

```
┌────────────────────────────────────────┐
│         Voice Agent Pipeline           │
├────────────────────────────────────────┤
│                                        │
│  STT Provider  → Tawk Agents SDK → TTS │
│  (Deepgram)      (LLM Layer)   (11Labs)│
│                      ↓                 │
│                 ┌────────┐             │
│                 │ Tools  │             │
│                 │Handoffs│             │
│                 │Guards  │             │
│                 │Sessions│             │
│                 └────────┘             │
└────────────────────────────────────────┘
```

**Tawk Agents SDK** handles all LLM orchestration, including:
- Agent execution with any AI model
- Tool calling and function execution
- Multi-agent handoffs and coordination
- Guardrails and safety checks
- Session and conversation memory management
- Observability and tracing

---

## How to Use

### Basic Setup

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';
import { tool, MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';

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
    instructions: 'You are a helpful voice assistant.',
    session: new MemorySession('session-id'),
  },
  
  tts: {
    provider: 'elevenlabs',
    apiKey: process.env.ELEVENLABS_API_KEY!,
    voiceId: process.env.ELEVENLABS_VOICE_ID!,
  },
});
```

### Adding Tools

Tawk Agents SDK provides powerful tool calling capabilities:

```typescript
import { tool } from '@tawk/voice-agents-sdk/core';
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

const voiceAgent = new VoiceAgent({
  agent: {
    model: openai('gpt-4o'),
    instructions: 'You are helpful.',
    tools: { getWeather },
  },
  // ... rest of config
});
```

### Multi-Agent Handoffs

Create specialized agents and enable automatic handoffs:

```typescript
import { Agent } from '@tawk/voice-agents-sdk/core';

const supportAgent = new Agent({
  name: 'Support',
  model: openai('gpt-4o'),
  instructions: 'Handle technical support questions.',
});

const billingAgent = new Agent({
  name: 'Billing',
  model: openai('gpt-4o'),
  instructions: 'Handle billing and payment issues.',
});

const voiceAgent = new VoiceAgent({
  agent: {
    model: openai('gpt-4o'),
    name: 'Coordinator',
    instructions: 'Route customers to the right specialist.',
    handoffs: [supportAgent, billingAgent],
  },
  // ... rest of config
});
```

The coordinator agent will automatically hand off to specialized agents when appropriate.

### Guardrails

Add safety checks and content validation:

```typescript
import { guardrails } from '@tawk/voice-agents-sdk/core';

const voiceAgent = new VoiceAgent({
  agent: {
    model: openai('gpt-4o'),
    instructions: 'You are helpful.',
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
        maxLength: 200,
        unit: 'words',
      }),
    ],
  },
  // ... rest of config
});
```

### Session Management

Maintain conversation context across turns:

```typescript
import { MemorySession, SessionManager } from '@tawk/voice-agents-sdk/core';

// In-memory session (for development)
const session = new MemorySession('session-id');

// Redis session (for production)
const sessionManager = new SessionManager({
  type: 'redis',
  redis: {
    host: 'localhost',
    port: 6379,
  },
});

const session = sessionManager.getSession('session-id');

const voiceAgent = new VoiceAgent({
  agent: {
    model: openai('gpt-4o'),
    instructions: 'You are helpful.',
    session,
  },
  // ... rest of config
});
```

---

## Complete Example

Here's a complete example showcasing all Tawk Agents SDK features:

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';
import { tool, MemorySession, Agent, guardrails } from '@tawk/voice-agents-sdk/core';
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

// Create specialized agents for handoffs
const supportAgent = new Agent({
  name: 'Support',
  model: openai('gpt-4o'),
  instructions: 'Handle technical support questions.',
});

const billingAgent = new Agent({
  name: 'Billing',
  model: openai('gpt-4o'),
  instructions: 'Handle billing questions.',
});

// Create voice agent with full Tawk Agents SDK integration
const voiceAgent = new VoiceAgent({
  transport: { type: 'websocket' },
  
  stt: {
    provider: 'deepgram',
    apiKey: process.env.DEEPGRAM_API_KEY!,
  },
  
  // Tawk Agents SDK configuration
  agent: {
    model: openai('gpt-4o'),
    name: 'VoiceAssistant',
    instructions: 'You are a helpful voice assistant.',
    
    // Tools
    tools: { getWeather },
    
    // Multi-agent handoffs
    handoffs: [supportAgent, billingAgent],
    
    // Guardrails
    guardrails: [
      guardrails.contentSafety({ type: 'output' }),
      guardrails.piiDetection({ type: 'output' }),
    ],
    
    // Session management
    session: new MemorySession('session-id'),
    
    // Model settings
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
});

await voiceAgent.initialize();

// Process text input
await voiceAgent.processText('What is the weather in Tokyo?');
// Flow: Text → Tawk Agents SDK (runs agent, calls tool) → TTS → Audio + Text
```

---

## Data Flow

Here's how data flows through the system:

```
1. Audio Input (or Text Input)
   ↓
2. STT Provider (if audio) → text
   ↓
3. Tawk Agents SDK (LLM Layer)
   - Runs agent with user input
   - Calls tools if needed
   - Handles handoffs
   - Applies guardrails
   - Manages conversation history
   - Traces everything
   ↓
4. TTS Provider → audio
   ↓
5. Audio Output + Text Output
```

---

## Key Features

### Tool Calling

Define custom tools that agents can call:

```typescript
const getWeather = tool({
  description: 'Get weather',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return { temp: 72, condition: 'sunny' };
  },
});

agent: {
  tools: { getWeather },
}
```

### Multi-Agent Handoffs

Create specialized agents and enable automatic routing:

```typescript
const specialist = new Agent({
  name: 'Specialist',
  model: openai('gpt-4o'),
  instructions: 'Expert in...',
});

agent: {
  handoffs: [specialist],
}
```

### Guardrails

Add safety checks and content validation:

```typescript
agent: {
  guardrails: [
    guardrails.contentSafety({ type: 'output' }),
    guardrails.piiDetection({ type: 'output' }),
    guardrails.length({ type: 'output', maxLength: 200 }),
  ],
}
```

### Session Management

Maintain conversation context:

```typescript
const session = new MemorySession('session-id');

agent: {
  session,
}
```

### Observability

Enable tracing with Langfuse:

```typescript
import { initializeLangfuse } from '@tawk/voice-agents-sdk/core';

initializeLangfuse();
// All agent runs are automatically traced
```

---

## How to Test

### Testing Voice Agents

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

### Testing Multi-Agent Handoffs

```typescript
it('should handle agent handoffs', async () => {
  const handoffs: any[] = [];
  
  voiceAgent.on('agent.handoff', (handoff) => {
    handoffs.push(handoff);
  });
  
  await voiceAgent.processText('I need billing help');
  
  // Verify handoff occurred
  expect(handoffs.length).toBeGreaterThan(0);
});
```

---

## Benefits

### Full Agent Capabilities

Tawk Agents SDK provides everything you need:
- Tool calling and function execution
- Multi-agent workflows and handoffs
- Guardrails and safety checks
- Session and memory management
- Observability and tracing
- Human-in-the-loop approvals
- Structured outputs

### Direct Agent Access

Access the underlying agent when needed:

```typescript
const agent = voiceAgent.getAgent();
// Use agent directly for advanced scenarios
```

### Multi-Provider Support

Works with any AI SDK provider:

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

agent: {
  model: openai('gpt-4o'),
  // or anthropic('claude-3-5-sonnet')
  // or google('gemini-2.0-flash')
}
```

### Advanced Workflows

Build complex multi-agent systems:

```typescript
const supportAgent = new Agent({ ... });
const billingAgent = new Agent({ ... });
const coordinator = new Agent({
  handoffs: [supportAgent, billingAgent],
});

agent: coordinator
```

---

## Summary

Tawk Voice Agents SDK is a **new SDK for building voice AI applications**. It's built on **Tawk Agents SDK**, which provides the complete LLM orchestration layer. This integration gives you:

- ✅ Full agent capabilities (tools, handoffs, guardrails)
- ✅ Multi-provider support (no vendor lock-in)
- ✅ Production-ready features (tracing, sessions, error handling)
- ✅ Clean architecture (STT → Agent → TTS)
- ✅ Ready for MediaSoup and telephony integration

**Perfect for building production-ready voice AI applications!** 🎙️

---

## See Also

- [API Reference](./API.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [Tawk Agents SDK Documentation](https://github.com/tawk/tawk-agents-sdk)
