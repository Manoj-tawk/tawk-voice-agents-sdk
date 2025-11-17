# Setup Instructions for Langfuse

## Quick Start

1. **Copy your Langfuse credentials to `.env`**:

```bash
# Add these lines to your .env file:
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key-here
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key-here
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

2. **Test the integration**:

```bash
npm run test:langfuse
```

3. **View your traces**:

Go to: [https://us.cloud.langfuse.com](https://us.cloud.langfuse.com)

## Complete .env Template

```env
# Tawk Agents SDK - Environment Variables

# Required for testing
OPENAI_API_KEY=your-openai-key-here

# Optional for multi-provider testing  
ANTHROPIC_API_KEY=your-anthropic-key-here
GOOGLE_GENERATIVE_AI_API_KEY=your-google-key-here

# Langfuse Tracing Configuration
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key-here
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key-here
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

## Usage in Your Code

### Automatic Initialization

```typescript
import { initializeLangfuse } from '@tawk-agents-sdk/core';

// Initialize once at app startup
initializeLangfuse();
```

### Using with Agents

```typescript
import { Agent, run, initializeLangfuse } from '@tawk-agents-sdk/core';

// Initialize Langfuse
initializeLangfuse();

// Use agents normally - tracing happens automatically
const agent = new Agent({
  name: 'Support Agent',
  instructions: 'You help customers',
});

const result = await run(agent, 'Hello!');
```

### Manual Tracing

```typescript
import {
  createTrace,
  createGeneration,
  updateGeneration,
  endGeneration,
} from '@tawk-agents-sdk/core';

const trace = createTrace({
  name: 'customer-query',
  userId: 'user-123',
  sessionId: 'session-456',
  tags: ['support', 'urgent'],
});

const generation = createGeneration(trace, {
  name: 'agent-response',
  model: 'gpt-4o',
  input: { message: 'Hello' },
});

// ... run your agent ...

updateGeneration(generation, {
  output: result.finalOutput,
  usage: {
    input: 100,
    output: 50,
    total: 150,
  },
});

endGeneration(generation);
```

## Next Steps

1. ✅ Add credentials to `.env`
2. ✅ Run `npm run test:langfuse`
3. ✅ Check your dashboard at https://us.cloud.langfuse.com
4. ✅ Start tracing your agents!

## Need Help?

- 📚 [Langfuse Documentation](https://langfuse.com/docs)
- 📖 [Full Integration Guide](./LANGFUSE.md)
- 🔧 [Troubleshooting](./LANGFUSE.md#troubleshooting)

