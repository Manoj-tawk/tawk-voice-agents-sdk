# Getting Started with Tawk Agents SDK

This guide will help you get started with Tawk Agents SDK in minutes.

## Prerequisites

- Node.js 18.0 or higher
- npm or yarn
- An OpenAI API key (or other supported provider)

## Installation

> **Note:** This package is currently in development. For now, clone the repository and build locally:

```bash
# Clone and build
git clone https://github.com/Manoj-tawk/tawk-agents-sdk.git
cd tawk-agents-sdk
npm install
npm run build

# Link for local development
npm link

# In your project
npm link @tawk-agents-sdk/core
npm install ai @ai-sdk/openai zod
```

**When published to npm:**
```bash
npm install @tawk-agents-sdk/core ai @ai-sdk/openai zod
```

### Dependencies

- `@tawk-agents-sdk/core` - The core SDK
- `ai` - Vercel AI SDK (peer dependency)
- `@ai-sdk/openai` - OpenAI provider (or use `@ai-sdk/anthropic`, `@ai-sdk/google`, etc.)
- `zod` - Schema validation (peer dependency)

## Environment Setup

Create a `.env` file in your project root:

```env
# Required - At least one AI provider
OPENAI_API_KEY=sk-...

# Optional - Other providers
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Optional - Langfuse tracing
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

## Your First Agent

Create a file `agent.ts`:

```typescript
import { Agent, run } from '@tawk-agents-sdk/core';
import { openai } from '@ai-sdk/openai';

// Create an agent
const agent = new Agent({
  name: 'Assistant',
  model: openai('gpt-4o-mini'),
  instructions: 'You are a helpful assistant. Be concise.',
});

// Run the agent
async function main() {
  const result = await run(agent, 'What is TypeScript?');
  console.log(result.finalOutput);
}

main();
```

Run it:

```bash
npm install dotenv
ts-node agent.ts
```

## Next Steps

### Add Tools

```typescript
import { tool } from '@tawk-agents-sdk/core';
import { z } from 'zod';

const calculator = tool({
  description: 'Perform calculations',
  parameters: z.object({
    expression: z.string(),
  }),
  execute: async ({ expression }) => {
    return { result: eval(expression) };
  },
});

const agent = new Agent({
  name: 'Calculator Agent',
  tools: { calculator },
});
```

### Add Session Memory

```typescript
import { SessionManager } from '@tawk-agents-sdk/core';

const sessionManager = new SessionManager({ type: 'memory' });
const session = sessionManager.getSession('user-123');

const result = await run(agent, 'My name is Alice', { session });
// Later...
const result2 = await run(agent, 'What is my name?', { session });
```

### Enable Tracing

```typescript
import { initializeLangfuse } from '@tawk-agents-sdk/core';

initializeLangfuse(); // Reads from .env

// All runs are now automatically traced!
```

## Learn More

- [Core Concepts](./CORE_CONCEPTS.md) - Understanding agents, tools, and more
- [API Reference](./API.md) - Complete API documentation
- [Testing Guide](./TESTING.md) - How to test your agents
- [Examples](../examples/complete-examples.ts) - Complete examples

## Common Issues

### TypeScript Errors

Make sure you have TypeScript 5.0+ and proper types:

```bash
npm install -D typescript @types/node
```

### API Key Issues

Verify your `.env` file is loaded:

```typescript
import { config } from 'dotenv';
config();
```

### Module Resolution

If you get import errors, check your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

## Need Help?

- 📚 [Full Documentation](../README.md)
- 💬 [GitHub Issues](https://github.com/Manoj-tawk/tawk-agents-sdk/issues)
- 📧 support@tawk.to

