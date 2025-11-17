# Langfuse Tracing Integration

The Tawk Agents SDK includes built-in support for [Langfuse](https://langfuse.com), providing automatic tracing and observability for your agent interactions.

## Setup

### 1. Get API Keys

1. Sign up at [Langfuse](https://langfuse.com) (or use US region: [us.cloud.langfuse.com](https://us.cloud.langfuse.com))
2. Create a new project
3. Copy your API keys from the project settings

### 2. Add Environment Variables

Add your Langfuse credentials to `.env`:

```env
# Langfuse Tracing
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com  # or https://cloud.langfuse.com
```

### 3. Initialize Langfuse

```typescript
import { initializeLangfuse } from '@tawk-agents-sdk/core';

// Initialize once at app startup
initializeLangfuse();
```

That's it! Langfuse will automatically initialize from environment variables.

## Usage

### Automatic Tracing

The SDK automatically traces:
- ✅ Agent conversations
- ✅ Tool executions
- ✅ Token usage
- ✅ Latency
- ✅ Errors

No additional code needed!

### Manual Tracing

For more control, use the Langfuse API directly:

```typescript
import {
  createTrace,
  createGeneration,
  updateGeneration,
  endGeneration,
  flushLangfuse,
} from '@tawk-agents-sdk/core';

// Create a trace
const trace = createTrace({
  name: 'customer-support',
  userId: 'user-123',
  sessionId: 'session-456',
  metadata: { department: 'sales' },
  tags: ['support', 'high-priority'],
});

// Create a generation
const generation = createGeneration(trace, {
  name: 'agent-response',
  model: 'gpt-4o',
  input: { message: 'Hello' },
});

// Run your agent...
const result = await run(agent, 'Hello');

// Update with results
updateGeneration(generation, {
  output: result.finalOutput,
  usage: {
    input: result.metadata.promptTokens,
    output: result.metadata.completionTokens,
    total: result.metadata.totalTokens,
  },
});

// End the generation
endGeneration(generation);

// Flush to Langfuse (happens automatically on shutdown)
await flushLangfuse();
```

### Trace Tool Executions

```typescript
import { createSpan, endSpan } from '@tawk-agents-sdk/core';

// Inside your tool execution
const span = createSpan(trace, {
  name: 'database-query',
  input: { query: 'SELECT * FROM users' },
  metadata: { table: 'users' },
});

// Execute tool...
const result = await db.query('SELECT * FROM users');

// End span
endSpan(span, {
  output: result,
  level: 'DEFAULT',
});
```

### Add Scores

```typescript
import { score } from '@tawk-agents-sdk/core';

score({
  traceId: 'trace-123',
  name: 'user-satisfaction',
  value: 0.95,
  comment: 'User rated 5 stars',
});
```

## Test Your Integration

Run the test script to verify everything works:

```bash
npm run test:langfuse
```

Expected output:
```
🧪 Testing Langfuse Integration

1️⃣  Initializing Langfuse...
✅ Langfuse initialized successfully!
   Enabled: true

2️⃣  Creating trace...
✅ Trace created

3️⃣  Running agent...
✅ Agent response: Hello from Tawk Agents SDK!

4️⃣  Updating trace with results...
✅ Trace updated

5️⃣  Flushing data to Langfuse...
✅ Data flushed

6️⃣  Shutting down Langfuse...
✅ Shutdown complete

🎉 Langfuse integration test completed successfully!

📊 Check your Langfuse dashboard:
   https://us.cloud.langfuse.com
```

## View Your Traces

1. Go to your Langfuse dashboard
2. Navigate to the "Traces" tab
3. See all your agent interactions with:
   - Full conversation history
   - Token usage and costs
   - Latency metrics
   - Tool executions
   - Errors and warnings

## Features

### Session Tracking

Langfuse automatically groups traces by session:

```typescript
const trace = createTrace({
  sessionId: 'user-123-session',
  userId: 'user-123',
});
```

### User Tracking

Track individual users:

```typescript
const trace = createTrace({
  userId: 'user-123',
  metadata: {
    email: 'user@example.com',
    plan: 'pro',
  },
});
```

### Tags

Organize traces with tags:

```typescript
const trace = createTrace({
  tags: ['production', 'customer-support', 'urgent'],
});
```

### Metadata

Add custom metadata:

```typescript
const trace = createTrace({
  metadata: {
    environment: 'production',
    version: '1.0.0',
    region: 'us-east-1',
  },
});
```

## API Reference

### `initializeLangfuse()`
Initialize Langfuse from environment variables.

### `getLangfuse()`
Get the current Langfuse instance.

### `isLangfuseEnabled()`
Check if Langfuse is enabled.

### `createTrace(options)`
Create a new trace.

### `createGeneration(trace, options)`
Create a generation span.

### `updateGeneration(generation, options)`
Update generation with output and usage.

### `endGeneration(generation, options)`
End a generation.

### `createSpan(trace, options)`
Create a span for tool execution.

### `endSpan(span, options)`
End a span.

### `score(options)`
Add a score to a trace.

### `flushLangfuse()`
Flush pending data to Langfuse.

### `shutdownLangfuse()`
Shutdown Langfuse and flush all data.

## Troubleshooting

### No traces appearing

1. Check environment variables are set
2. Verify API keys are correct
3. Check network connectivity to Langfuse
4. Call `await flushLangfuse()` to manually flush

### Traces are delayed

- Langfuse batches traces for performance
- Call `await flushLangfuse()` to send immediately
- Traces appear within a few seconds

### Memory issues

- Call `shutdownLangfuse()` when done
- Set `flushAt` lower in initialization

## Learn More

- [Langfuse Documentation](https://langfuse.com/docs)
- [Langfuse Tracing Guide](https://langfuse.com/docs/observability/get-started)
- [Vercel AI SDK Integration](https://langfuse.com/docs/integrations/vercel-ai-sdk)

