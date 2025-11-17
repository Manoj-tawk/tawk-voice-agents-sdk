# Core Concepts

Understanding the fundamental concepts of Tawk Agents SDK.

## Agents

**Agents** are AI entities with specific instructions, tools, and capabilities.

```typescript
const agent = new Agent({
  name: 'Support Agent',           // Agent name (for logging)
  model: openai('gpt-4o'),          // AI model
  instructions: 'You help users',   // System instructions
  tools: {},                         // Available tools
  handoffs: [],                      // Other agents to delegate to
  guardrails: [],                    // Safety/quality checks
});
```

### Key Properties

- **name**: Identifier for the agent (used in logs and traces)
- **model**: The AI model to use (from any Vercel AI SDK provider)
- **instructions**: System prompt defining the agent's behavior
- **tools**: Functions the agent can call
- **handoffs**: Other agents this agent can delegate to
- **guardrails**: Validation rules for inputs/outputs

## Tools

**Tools** are functions that agents can call to perform actions.

```typescript
const tool = tool({
  description: 'What this tool does',
  parameters: z.object({
    param: z.string().describe('Parameter description'),
  }),
  execute: async ({ param }) => {
    // Tool implementation
    return { result: 'value' };
  },
});
```

### Tool Execution Flow

1. Agent decides to use a tool
2. SDK validates parameters against schema
3. Tool's `execute` function is called
4. Result is returned to the agent
5. Agent continues with the result

## Sessions

**Sessions** maintain conversation history across multiple turns.

```typescript
const sessionManager = new SessionManager({ type: 'memory' });
const session = sessionManager.getSession('user-123');

// First message
await run(agent, 'My name is Alice', { session });

// Second message - remembers context
await run(agent, 'What is my name?', { session });
```

### Session Types

- **memory**: In-memory (dev/testing)
- **redis**: Redis-backed (production)
- **mongodb**: MongoDB-backed (production)
- **hybrid**: Memory + persistent storage

## Context

**Context** provides request-scoped data to tools automatically via context injection.

```typescript
interface UserContext {
  userId: string;
  permissions: string[];
}

const permissionTool = tool({
  description: 'Check permissions',
  parameters: z.object({}),
  execute: async ({}, contextWrapper) => {
    // Context is automatically injected by the SDK
    const context = contextWrapper?.context as UserContext;
    return { hasAccess: context.permissions.includes('admin') };
  },
});

// Create agent with the tool
const agent = new Agent({
  name: 'Security Agent',
  tools: { permissionTool },
});

// Pass context when running the agent
const context: UserContext = {
  userId: 'user-123',
  permissions: ['admin'],
};

await run(agent, 'Check my access', { context });
```

### How Context Injection Works

The SDK automatically wraps each tool's `execute` function to inject the `RunContextWrapper` as the second parameter. This wrapper contains:

- `context`: Your custom context object
- `agent`: The current agent instance
- `messages`: Conversation messages
- `usage`: Token usage tracking

**No manual wrapping or closures needed!**

## Guardrails

**Guardrails** validate inputs and outputs for safety and quality.

```typescript
import { guardrails } from '@tawk-agents-sdk/core';

const agent = new Agent({
  guardrails: [
    guardrails.contentSafety(),      // Block harmful content
    guardrails.piiDetection(),       // Detect/redact PII
    guardrails.length({ max: 500 }), // Enforce length limits
  ],
});
```

### Guardrail Flow

**Input Guardrails** (before agent):
```
User Input → Input Guardrails → Agent
```

**Output Guardrails** (after agent):
```
Agent → Output Guardrails → Final Output
```

## Handoffs

**Handoffs** allow agents to delegate tasks to specialized agents.

```typescript
const sqlAgent = new Agent({
  name: 'SQL Expert',
  instructions: 'You write SQL queries',
});

const pythonAgent = new Agent({
  name: 'Python Expert',
  instructions: 'You write Python code',
});

const mainAgent = new Agent({
  name: 'Main Agent',
  instructions: 'Route tasks to experts',
  handoffs: [sqlAgent, pythonAgent],
});

// Agent automatically delegates to the right specialist
await run(mainAgent, 'Write a SQL query for users table');
```

## Streaming

**Streaming** provides real-time responses as they're generated.

```typescript
const stream = await runStream(agent, 'Tell me a story');

// Stream text chunks
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}

// Get final result
const result = await stream.completed;
```

## Multi-Agent Workflows

**Workflows** orchestrate multiple agents working together.

```typescript
// Sequential workflow
const research = await run(researchAgent, 'Research AI');
const draft = await run(writerAgent, `Write about: ${research.output}`);
const final = await run(editorAgent, `Edit: ${draft.output}`);

// Parallel workflow
const [analysis1, analysis2] = await Promise.all([
  run(agent1, 'Analyze market'),
  run(agent2, 'Analyze competitors'),
]);
```

## Tracing

**Tracing** provides observability for debugging and monitoring.

```typescript
import { initializeLangfuse } from '@tawk-agents-sdk/core';

// Initialize once
initializeLangfuse();

// All agent runs are automatically traced
await run(agent, 'Hello'); // Appears in Langfuse dashboard
```

## Error Handling

**Custom error types** for different failure scenarios.

```typescript
import {
  MaxTurnsExceededError,
  GuardrailTripwireTriggered,
  ToolExecutionError,
} from '@tawk-agents-sdk/core';

try {
  await run(agent, 'Your message');
} catch (error) {
  if (error instanceof MaxTurnsExceededError) {
    // Handle max turns exceeded
  } else if (error instanceof GuardrailTripwireTriggered) {
    // Handle guardrail failure
  }
}
```

## Best Practices

### 1. Clear Instructions

```typescript
// ❌ Bad
instructions: 'Help users'

// ✅ Good
instructions: 'You are a customer support agent. Be friendly, concise, and professional. Always verify user identity before accessing account information.'
```

### 2. Descriptive Tool Schemas

```typescript
// ❌ Bad
parameters: z.object({ q: z.string() })

// ✅ Good
parameters: z.object({
  query: z.string().describe('The search query to execute'),
})
```

### 3. Use Sessions for Multi-Turn

```typescript
// ❌ Bad - No memory
await run(agent, 'My name is Alice');
await run(agent, 'What is my name?'); // Agent won't remember

// ✅ Good - With session
await run(agent, 'My name is Alice', { session });
await run(agent, 'What is my name?', { session }); // Remembers!
```

### 4. Handle Errors Gracefully

```typescript
try {
  const result = await run(agent, input);
  return result.finalOutput;
} catch (error) {
  if (error instanceof GuardrailTripwireTriggered) {
    return 'Your request was blocked for safety reasons.';
  }
  throw error; // Re-throw unexpected errors
}
```

## Next Steps

- [API Reference](./API.md) - Complete API documentation
- [Testing Guide](./TESTING.md) - How to test your agents
- [Langfuse Integration](./LANGFUSE.md) - Observability and tracing
- [Examples](../examples/complete-examples.ts) - Complete usage examples

