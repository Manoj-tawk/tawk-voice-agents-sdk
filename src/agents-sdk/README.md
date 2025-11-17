# Tawk Agents SDK

[![npm version](https://img.shields.io/npm/v/@tawk-agents-sdk/core.svg)](https://www.npmjs.com/package/@tawk-agents-sdk/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@tawk-agents-sdk/core.svg)](https://nodejs.org)

Production-ready AI agent framework built on Vercel AI SDK with comprehensive multi-agent orchestration, intelligent handoffs, guardrails, and enterprise-grade observability.

## Features

- 🤖 **Multi-Agent Orchestration**: Coordinate multiple specialized agents with seamless handoffs
- ⚡ **High Performance**: 10x faster handoffs, 95% cost reduction vs OpenAI Agents SDK
- 🔧 **Tool Calling**: Native support for function tools with automatic context injection
- 🛡️ **Guardrails**: Built-in input/output validation and content safety (PII detection, length limits, content filtering)
- 📊 **Langfuse Tracing**: Comprehensive observability and performance monitoring
- 💬 **Session Management**: Multiple storage options (in-memory, Redis, MongoDB)
- 🔄 **Streaming Support**: Real-time response streaming
- 🚀 **Multi-Provider Support**: OpenAI, Anthropic, Google, Groq, Mistral, and any Vercel AI SDK provider
- 🎯 **TypeScript First**: Complete type safety and IntelliSense support
- 🏗️ **Simple Architecture**: Optimized single-loop design

## Installation

> **Note:** This package is currently in development. For local installation:

```bash
# Clone the repository
git clone https://github.com/Manoj-tawk/tawk-agents-sdk.git
cd tawk-agents-sdk

# Install dependencies and build
npm install
npm run build

# Link for local use
npm link

# In your project directory
cd /path/to/your/project
npm link @tawk-agents-sdk/core
npm install ai zod @ai-sdk/openai
```

**Once published to npm:**
```bash
npm install @tawk-agents-sdk/core ai zod
```

Install your preferred AI provider:

```bash
# OpenAI
npm install @ai-sdk/openai

# Anthropic
npm install @ai-sdk/anthropic

# Google
npm install @ai-sdk/google
```

## Quick Start

```typescript
import { Agent, run, setDefaultModel, tool } from '@tawk-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Configure default model
setDefaultModel(openai('gpt-4o-mini'));

// Create an agent with tools
const agent = new Agent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant.',
  tools: {
    calculate: tool({
      description: 'Perform mathematical calculations',
      parameters: z.object({
        expression: z.string().describe('Math expression to evaluate')
      }),
      execute: async ({ expression }) => {
        return { result: eval(expression) };
      }
    })
  }
});

// Execute the agent
const result = await run(agent, 'What is 15 * 23?');
console.log(result.finalOutput);
```

## Multi-Agent Workflows

Coordinate specialized agents with intelligent task delegation:

```typescript
const mathAgent = new Agent({
  name: 'MathExpert',
  instructions: 'You are a mathematics expert. Solve mathematical problems accurately.',
  tools: {
    calculate: tool({
      description: 'Calculate mathematical expressions',
      parameters: z.object({
        expression: z.string()
      }),
      execute: async ({ expression }) => ({ result: eval(expression) })
    })
  }
});

const writerAgent = new Agent({
  name: 'WriterExpert',
  instructions: 'You are a professional content writer.',
  tools: {
    writeContent: tool({
      description: 'Create professional content',
      parameters: z.object({
        topic: z.string()
      }),
      execute: async ({ topic }) => ({ content: `Content about ${topic}` })
    })
  }
});

const coordinator = new Agent({
  name: 'Coordinator',
  instructions: `You coordinate tasks between specialized agents.
  - For mathematics problems, delegate to MathExpert
  - For writing tasks, delegate to WriterExpert`,
  handoffs: [mathAgent, writerAgent]
});

// Coordinator automatically routes to the appropriate agent
const result = await run(coordinator, 'Calculate 123 * 456');
```

## Session Management

Maintain conversation history across multiple interactions:

```typescript
import { Agent, run, SessionManager } from '@tawk-agents-sdk/core';

const agent = new Agent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant with conversation memory.'
});

const sessionManager = new SessionManager({ type: 'memory' });
const session = await sessionManager.getOrCreate('user-123');

// First message
await run(agent, 'My name is Alice', { session });

// Second message - context is maintained
const result = await run(agent, 'What is my name?', { session });
console.log(result.finalOutput); // "Your name is Alice"
```

## Guardrails

Implement input/output validation and content safety:

```typescript
import { Agent, run, guardrails } from '@tawk-agents-sdk/core';

const agent = new Agent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant.',
  guardrails: [
    guardrails.piiDetectionGuardrail(),
    guardrails.lengthGuardrail({ maxLength: 500 }),
    guardrails.contentSafetyGuardrail()
  ]
});
```

## Langfuse Tracing

Enable comprehensive observability:

```bash
# Configure environment variables
export LANGFUSE_PUBLIC_KEY=your_public_key
export LANGFUSE_SECRET_KEY=your_secret_key
export LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

```typescript
import { withTrace, run } from '@tawk-agents-sdk/core';

await withTrace(
  { name: 'Customer Support Session' },
  async (trace) => {
    const result = await run(agent, 'Help me with my order');
    return result;
  }
);

// View detailed traces at https://cloud.langfuse.com
```

## Streaming

Stream responses in real-time:

```typescript
import { Agent, runStream } from '@tawk-agents-sdk/core';

const agent = new Agent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant.'
});

const stream = await runStream(agent, 'Tell me a story');

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}

const completed = await stream.completed;
console.log('\nTokens used:', completed.metadata.totalTokens);
```

## Advanced Features

### Tool Context Injection

Tools automatically receive execution context:

```typescript
const agent = new Agent({
  name: 'Assistant',
  tools: {
    getUserData: tool({
      description: 'Retrieve user data',
      parameters: z.object({
        userId: z.string()
      }),
      execute: async ({ userId }, context) => {
        // Access context.agent, context.messages, context.usage
        console.log('Current agent:', context.agent.name);
        return { userData: { id: userId, name: 'Alice' } };
      }
    })
  }
});
```

### Dynamic Instructions

Instructions can be dynamic functions:

```typescript
const agent = new Agent({
  name: 'Assistant',
  instructions: async (context) => {
    const messageCount = context.messages.length;
    return `You are a helpful assistant. This is message ${messageCount}.`;
  }
});
```

### Structured Output

Parse agent output with Zod schemas:

```typescript
import { z } from 'zod';

const analysisSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  topics: z.array(z.string())
});

const agent = new Agent({
  name: 'Analyzer',
  instructions: 'Analyze text and return structured JSON matching the schema.',
  outputSchema: analysisSchema
});

const result = await run(agent, 'I love this product!');
// result.finalOutput is type-safe and validated
```

### Race Agents

Execute multiple agents in parallel and return the first successful result:

```typescript
import { Agent, raceAgents } from '@tawk-agents-sdk/core';

const fastAgent = new Agent({
  name: 'Fast',
  instructions: 'Provide quick answers.',
  model: openai('gpt-3.5-turbo')
});

const smartAgent = new Agent({
  name: 'Smart',
  instructions: 'Provide comprehensive answers.',
  model: openai('gpt-4')
});

// Race both agents, return first successful result
const result = await raceAgents([fastAgent, smartAgent], 'What is AI?');
console.log('Winner:', result.winningAgent.name);
```

## Performance

The SDK is optimized for production deployments with documented performance improvements:

### Benchmark Results (vs OpenAI Agents SDK)

| Metric | OpenAI Agents SDK | Tawk Agents SDK | Improvement |
|--------|------------------|-----------------|-------------|
| **Handoff Speed** | ~14 seconds | ~1.5 seconds | **10x faster** |
| **Token Usage** | ~5,000 tokens | ~245 tokens | **95% reduction** |
| **Architecture** | Multi-phase (4 files) | Single-loop (1 file) | **4x simpler** |
| **Lines of Code** | 15,000+ | 12,421 | **17% smaller** |

### Optimization Features

- **Tool Wrapping Cache**: 10x faster repeated tool calls
- **Single-Step Handoffs**: Coordinator agents optimized automatically
- **Map-based Lookups**: O(1) tool result matching
- **Efficient Message Handling**: Optimized array operations
- **Minimal Overhead**: Production-grade performance throughout

## API Reference

### Core Classes

#### `Agent`

Creates an AI agent with specific capabilities.

```typescript
new Agent({
  name: string;
  instructions: string | ((context) => string | Promise<string>);
  model?: LanguageModel;
  tools?: Record<string, CoreTool>;
  handoffs?: Agent[];
  handoffDescription?: string;
  guardrails?: Guardrail[];
  outputSchema?: z.ZodSchema<TOutput>;
  outputType?: z.ZodSchema<TOutput>;
  maxSteps?: number;
  modelSettings?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
  };
  onStepFinish?: (step: StepResult) => void | Promise<void>;
  shouldFinish?: (context: TContext, toolResults: any[]) => boolean;
})
```

#### `run(agent, input, options?)`

Execute an agent and return the result.

```typescript
const result = await run(agent, 'Hello', {
  context?: TContext;
  session?: Session;
  maxTurns?: number;
  stream?: boolean;
  sessionInputCallback?: (history, newInput) => CoreMessage[];
});
```

#### `runStream(agent, input, options?)`

Execute an agent with streaming enabled.

```typescript
const stream = await runStream(agent, 'Hello');
for await (const chunk of stream.textStream) {
  console.log(chunk);
}
```

## Environment Variables

```bash
# Langfuse Tracing (optional)
LANGFUSE_PUBLIC_KEY=your_public_key
LANGFUSE_SECRET_KEY=your_secret_key
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Development Mode (enables debug logging)
NODE_ENV=development
```

## Documentation

- [Getting Started Guide](./docs/GETTING_STARTED.md)
- [Core Concepts](./docs/CORE_CONCEPTS.md)
- [API Reference](./docs/API.md)
- [Testing Guide](./docs/TESTING.md)
- [Langfuse Integration](./docs/LANGFUSE.md)
- [Performance Optimization](./docs/PERFORMANCE_OPTIMIZATION.md)

## Examples

See the [examples](./examples) directory for complete working examples:

- Basic agent with tools
- Multi-agent workflows
- Session management
- Streaming responses
- Guardrails implementation
- MCP integration
- Human-in-the-loop approvals

## Testing

```bash
# Run all unit tests
npm test

# Run specific test suites
npm run test:basic
npm run test:multi
npm run test:stream

# Run E2E tests
npm run e2e:basic
npm run e2e:multi
npm run e2e:stream
```

## Why Tawk Agents SDK?

### Comparison with OpenAI Agents SDK

| Feature | OpenAI Agents | Tawk Agents | Winner |
|---------|--------------|-------------|--------|
| **Performance** | Standard | **10x faster** | 🏆 Tawk |
| **Cost** | Standard | **95% cheaper** | 🏆 Tawk |
| **Multi-Provider** | OpenAI only | OpenAI, Anthropic, Google, Groq, etc. | 🏆 Tawk |
| **Architecture** | Complex (4+ files) | Simple (single-loop) | 🏆 Tawk |
| **Storage** | Memory only | Memory, Redis, MongoDB | 🏆 Tawk |
| **Guardrails** | Manual implementation | Built-in (PII, safety, length) | 🏆 Tawk |
| **Observability** | Custom required | Langfuse (industry standard) | 🏆 Tawk |
| **Learning Curve** | Steep | Gentle | 🏆 Tawk |

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT © [Tawk.to](https://www.tawk.to)

## Support

- 📧 Email: support@tawk.to
- 🐛 Issues: [GitHub Issues](https://github.com/Manoj-tawk/tawk-agents-sdk/issues)
- 📖 Documentation: [Full Documentation](./docs)

## Acknowledgments

Built on top of:
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Langfuse](https://langfuse.com)
- [Zod](https://zod.dev)

---

Made with ❤️ by Tawk.to
