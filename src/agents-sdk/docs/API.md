# API Reference

Complete API reference for Tawk Agents SDK.

## Table of Contents

- [Core Functions](#core-functions)
- [Agent Class](#agent-class)
- [Tool Definition](#tool-definition)
- [Session Management](#session-management)
- [Session Auto-Summarization](#session-auto-summarization)
- [Guardrails](#guardrails)
- [Handoffs](#handoffs)
- [Tracing Context](#tracing-context)
- [Tracing Utilities](#tracing-utilities)
- [Generic Tracing System](#generic-tracing-system)
- [MCP (Model Context Protocol)](#mcp-model-context-protocol)
- [Human-in-the-Loop (Approvals)](#human-in-the-loop-approvals)
- [Usage Tracking](#usage-tracking)
- [RunState](#runstate)
- [Enhanced Results](#enhanced-results)
- [Message Helpers](#message-helpers)
- [Safe Execution Utilities](#safe-execution-utilities)
- [Lifecycle Hooks](#lifecycle-hooks)
- [Events](#events)
- [Langfuse Integration](#langfuse-integration)
- [Types](#types)
- [Error Classes](#error-classes)
- [Background Results](#background-results)
- [Version](#version)

## Core Functions

### `run(agent, input, options?)`

Execute an agent with input and return the final result.

**Parameters:**
- `agent: Agent` - The agent to run
- `input: string | CoreMessage[]` - User input
- `options?: RunOptions` - Optional configuration

**Returns:** `Promise<RunResult>`

**Example:**
```typescript
const result = await run(agent, 'Hello!', {
  session,
  context,
  maxTurns: 10,
});
```

**RunOptions:**
```typescript
interface RunOptions<TContext = any> {
  session?: Session;        // Session for history
  context?: TContext;       // Request-scoped data
  maxTurns?: number;        // Max turns (default: 100)
  onStepFinish?: (step: StepResult) => void;  // Step callback
}
```

**RunResult:**
```typescript
interface RunResult<TOutput = string> {
  finalOutput: TOutput;     // Final agent output
  steps: StepResult[];      // All execution steps
  metadata: RunMetadata;    // Token usage, etc.
}
```

### `runStream(agent, input, options?)`

Stream agent responses in real-time.

**Parameters:**
- `agent: Agent` - The agent to run
- `input: string | CoreMessage[]` - User input
- `options?: RunOptions` - Optional configuration

**Returns:** `Promise<StreamResult>`

**Example:**
```typescript
const stream = await runStream(agent, 'Tell me a story');

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}

const result = await stream.completed;
```

**StreamResult:**
```typescript
interface StreamResult {
  textStream: AsyncIterable<string>;
  fullStream: AsyncIterable<StreamChunk>;
  completed: Promise<RunResult>;
}
```

### `raceAgents(agents, input, options?)`

Execute multiple agents in parallel and return the first successful result. Useful for fallback patterns, redundancy, and performance optimization.

**Parameters:**
- `agents: Agent[]` - Array of agents to race
- `input: string | CoreMessage[]` - User input
- `options?: RunOptions` - Optional configuration

**Returns:** `Promise<RunResult & { winningAgent: Agent }>`

**Example:**
```typescript
import { Agent, raceAgents } from '@tawk-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// Create multiple agents with different models
const gptAgent = new Agent({
  name: 'GPT Agent',
  model: openai('gpt-4o-mini'),
  instructions: 'Answer concisely',
});

const claudeAgent = new Agent({
  name: 'Claude Agent',
  model: anthropic('claude-3-haiku-20240307'),
  instructions: 'Answer concisely',
});

// Race them - fastest response wins
const result = await raceAgents(
  [gptAgent, claudeAgent],
  'What is TypeScript?'
);

console.log('Winner:', result.winningAgent.name);
console.log('Answer:', result.finalOutput);
console.log('Participants:', result.metadata.raceParticipants);
```

**Use Cases:**
- **Fallback Pattern**: Primary agent with backup agents
- **Performance**: Use fastest available model
- **Redundancy**: Increase reliability with multiple providers
- **Cost Optimization**: Race cheap model vs expensive model

**Result Metadata:**
```typescript
interface RaceResult extends RunResult {
  winningAgent: Agent;           // Agent that completed first
  metadata: {
    ...RunResult.metadata,
    raceWinners: string[];       // Winning agent names
    raceParticipants: string[];  // All participating agent names
  }
}
```

**Error Handling:**
If all agents fail, throws an error with details:
```typescript
try {
  const result = await raceAgents([agent1, agent2], 'Query');
} catch (error) {
  // Error message includes failure details from all agents
  console.error(error.message);
  // "All agents failed in race:
  //   GPT Agent: Rate limit exceeded
  //   Claude Agent: Network timeout"
}
```

### `tool(config)`

Define a tool that agents can use.

**Parameters:**
- `config: ToolConfig` - Tool configuration

**Returns:** `CoreTool`

**Example:**
```typescript
const myTool = tool({
  description: 'Tool description',
  parameters: z.object({
    param: z.string().describe('Parameter description'),
  }),
  execute: async ({ param }, contextWrapper) => {
    // Access context via contextWrapper.context
    const context = contextWrapper?.context;
    return { result: 'value' };
  },
});
```

**ToolConfig:**
```typescript
interface ToolConfig<TParams, TContext, TResult> {
  description: string;
  parameters: z.ZodObject<TParams>;
  execute: (params: TParams, contextWrapper?: RunContextWrapper<TContext>) => Promise<TResult>;
}
```

### `setDefaultModel(model)`

Set a default model for all agents.

**Parameters:**
- `model: LanguageModel` - Model from AI SDK provider

**Example:**
```typescript
import { openai } from '@ai-sdk/openai';

setDefaultModel(openai('gpt-4o-mini'));
```

## Agent Class

### Constructor

```typescript
class Agent<TContext = any, TOutput = string> {
  constructor(config: AgentConfig<TContext, TOutput>);
}
```

**AgentConfig:**
```typescript
interface AgentConfig<TContext = any, TOutput = string> {
  name: string;                           // Agent name
  model?: LanguageModel;                  // AI model (optional if default set)
  instructions: string | ((context: RunContextWrapper<TContext>) => string | Promise<string>);
  tools?: Record<string, CoreTool>;       // Available tools
  handoffs?: Agent[];                     // Delegate tasks to other specialized agents
  guardrails?: Guardrail[];               // Input/output validation
  outputSchema?: z.ZodSchema<TOutput>;    // Structured output schema
  modelSettings?: ModelSettings;          // Model parameters
}
```

**ModelSettings:**
```typescript
interface ModelSettings {
  temperature?: number;      // 0.0 - 2.0
  topP?: number;            // 0.0 - 1.0
  maxTokens?: number;       // Max output tokens
  presencePenalty?: number; // -2.0 - 2.0
  frequencyPenalty?: number;// -2.0 - 2.0
}
```

### Properties

```typescript
agent.name: string;              // Agent name
agent.instructions: string;      // Agent instructions
```

### Methods

#### `clone(overrides?)`

Create a copy of the agent with optional overrides.

```typescript
const clone = agent.clone({
  name: 'New Name',
  instructions: 'Updated instructions',
});
```

#### `asTool(options?)`

Convert agent to a tool usable by other agents.

```typescript
const agentTool = agent.asTool({
  toolName: 'consult_expert',
  toolDescription: 'Consult the expert agent',
});

const mainAgent = new Agent({
  tools: { expert: agentTool },
});
```

## Session Management

### SessionManager

```typescript
class SessionManager {
  constructor(config: SessionManagerConfig);
  getSession(sessionId: string): Session;
}
```

**SessionManagerConfig:**
```typescript
interface SessionManagerConfig {
  type: 'memory' | 'redis' | 'database' | 'hybrid';
  redis?: Redis;                    // Required for 'redis' and 'hybrid' types
  db?: any;                         // Required for 'database' and 'hybrid' types (MongoDB instance)
  redisKeyPrefix?: string;          // Default: 'agent:session:'
  redisTTL?: number;                // TTL in seconds (optional)
  dbCollectionName?: string;        // Default: 'sessions'
  maxMessages?: number;             // Maximum messages to keep
  syncToDBInterval?: number;       // For hybrid: sync to DB every N messages (default: 5)
  summarization?: SummarizationConfig;
}

interface SummarizationConfig {
  enabled: boolean;
  messageThreshold: number;        // Summarize after N messages
  keepRecentMessages: number;       // Keep last N messages verbatim
  model?: LanguageModel;            // LLM for summarization (optional)
  summaryPrompt?: string;           // Custom prompt (optional)
}
```

**Example Configurations:**

```typescript
// Memory session
const memoryManager = new SessionManager({
  type: 'memory',
  summarization: {
    enabled: true,
    messageThreshold: 10,
    keepRecentMessages: 3,
  },
});

// Redis session
import Redis from 'ioredis';
const redis = new Redis({ host: 'localhost', port: 6379 });
const redisManager = new SessionManager({
  type: 'redis',
  redis,
  redisKeyPrefix: 'myapp:sessions:',
  redisTTL: 3600, // 1 hour
  summarization: {
    enabled: true,
    messageThreshold: 20,
    keepRecentMessages: 5,
  },
});

// MongoDB session
import { MongoClient } from 'mongodb';
const client = new MongoClient('mongodb://localhost:27017');
const db = client.db('agents');
const dbManager = new SessionManager({
  type: 'database',
  db,
  dbCollectionName: 'conversations',
  summarization: {
    enabled: true,
    messageThreshold: 15,
    keepRecentMessages: 4,
  },
});

// Hybrid (Redis + MongoDB)
const hybridManager = new SessionManager({
  type: 'hybrid',
  redis,
  db,
  syncToDBInterval: 10, // Sync every 10 messages
  summarization: {
    enabled: true,
    messageThreshold: 10,
    keepRecentMessages: 3,
  },
});
```

### Session Interface

```typescript
interface Session {
  id: string;
  getHistory(): Promise<CoreMessage[]>;
  appendMessage(message: CoreMessage): Promise<void>;
  clear(): Promise<void>;
}
```

## Guardrails

Add safety and quality controls to your agents.

### Built-in Guardrails

You can use guardrails via the `guardrails` object or import individual functions:

```typescript
import { guardrails, contentSafetyGuardrail, piiDetectionGuardrail, lengthGuardrail } from '@tawk-agents-sdk/core';

// Using guardrails object (recommended)
const agent = new Agent({
  guardrails: [
    guardrails.contentSafety({ provider: 'openai' }),
    guardrails.piiDetection({ action: 'block' }),
  ],
});

// Or using individual functions
const agent2 = new Agent({
  guardrails: [
    contentSafetyGuardrail({ provider: 'openai' }),
    piiDetectionGuardrail({ action: 'block' }),
  ],
});
```

### Available Guardrails

#### Content Safety
```typescript
guardrails.contentSafety(config?: {
  type?: 'input' | 'output';
  provider?: 'openai' | 'custom';
  apiKey?: string;
  action?: 'block' | 'flag' | 'redact';
  categories?: string[];
  threshold?: number;
})

// Or use function directly
contentSafetyGuardrail(config)
```

#### PII Detection
```typescript
guardrails.piiDetection(config?: {
  type?: 'input' | 'output';
  types?: ('email' | 'phone' | 'ssn' | 'creditCard')[];
  action?: 'block' | 'flag' | 'redact';
})

// Or use function directly
piiDetectionGuardrail(config)
```

#### Length Validation
```typescript
guardrails.length(config: {
  type: 'input' | 'output';
  minLength?: number;
  maxLength?: number;
  unit?: 'characters' | 'words' | 'tokens';
})

// Or use function directly
lengthGuardrail(config)
```

#### Topic Relevance
```typescript
guardrails.topicRelevance(config: {
  type?: 'input' | 'output';
  allowedTopics: string[];
  threshold?: number;
})
```

#### Format Validation
```typescript
guardrails.formatValidation(config: {
  type?: 'input' | 'output';
  format: 'json' | 'email' | 'url' | 'custom';
  pattern?: RegExp;
})
```

#### Rate Limiting
```typescript
guardrails.rateLimit(config: {
  type?: 'input' | 'output';
  maxRequests: number;
  windowMs: number;
})
```

#### Language Detection
```typescript
guardrails.language(config: {
  type?: 'input' | 'output';
  allowedLanguages: string[];
})
```

#### Sentiment Analysis
```typescript
guardrails.sentiment(config: {
  type?: 'input' | 'output';
  allowedSentiments: ('positive' | 'neutral' | 'negative')[];
})
```

#### Toxicity Detection
```typescript
guardrails.toxicity(config: {
  type?: 'input' | 'output';
  threshold?: number;  // 0.0 - 1.0
  action?: 'block' | 'flag';
})
```

#### Custom Guardrail
```typescript
guardrails.custom(config: {
  name: string;
  type: 'input' | 'output';
  validate: (content: string, context?: any) => Promise<GuardrailResult>;
})
```

**GuardrailResult:**
```typescript
interface GuardrailResult {
  passed: boolean;
  message?: string;
  metadata?: Record<string, any>;
}
```

## Langfuse Integration

Complete Langfuse integration for observability and tracing.

### initializeLangfuse()

Initialize Langfuse tracing (reads from environment variables).

```typescript
function initializeLangfuse(): Langfuse | null;
```

**Environment Variables:**
- `LANGFUSE_PUBLIC_KEY` - Public key (required)
- `LANGFUSE_SECRET_KEY` - Secret key (required)
- `LANGFUSE_HOST` - Host URL (default: https://cloud.langfuse.com)

### getLangfuse()

Get the Langfuse instance.

```typescript
function getLangfuse(): Langfuse | null;
```

### isLangfuseEnabled()

Check if Langfuse is enabled.

```typescript
function isLangfuseEnabled(): boolean;
```

### createTrace()

Create a new trace.

```typescript
function createTrace(options: {
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}): Trace | null;
```

### createGeneration()

Create a generation within a trace.

```typescript
function createGeneration(
  trace: any,
  options: {
    name: string;
    model: string;
    input: any;
    output?: any;
    metadata?: Record<string, any>;
  }
): any | null;
```

### updateGeneration()

Update an existing generation.

```typescript
function updateGeneration(
  generation: any,
  options: {
    output?: any;
    metadata?: Record<string, any>;
    level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  }
): void;
```

### endGeneration()

End a generation.

```typescript
function endGeneration(
  generation: any,
  options?: {
    output?: any;
    metadata?: Record<string, any>;
    level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  }
): void;
```

### createSpan()

Create a span within a trace.

```typescript
function createSpan(
  trace: any,
  options: {
    name: string;
    input?: any;
    metadata?: Record<string, any>;
  }
): any | null;
```

### endSpan()

End a span.

```typescript
function endSpan(
  span: any,
  options?: {
    output?: any;
    metadata?: Record<string, any>;
    level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
    statusMessage?: string;
  }
): void;
```

### score()

Add a score to a trace or generation.

```typescript
function score(options: {
  traceId?: string;
  generationId?: string;
  name: string;
  value: number;
  comment?: string;
}): void;
```

### flushLangfuse()

Flush pending Langfuse events.

```typescript
function flushLangfuse(): Promise<void>;
```

### shutdownLangfuse()

Shutdown Langfuse client.

```typescript
function shutdownLangfuse(): Promise<void>;
```

**Example:**
```typescript
import {
  initializeLangfuse,
  createTrace,
  createGeneration,
  endGeneration,
  createSpan,
  endSpan,
  score,
  flushLangfuse,
} from '@tawk-agents-sdk/core';

// Initialize
initializeLangfuse();

// Create trace
const trace = createTrace({
  name: 'Agent Run',
  userId: 'user-123',
  metadata: { version: '1.0.0' },
});

// Create generation
const generation = createGeneration(trace, {
  name: 'Agent Response',
  model: 'gpt-4o',
  input: 'Hello!',
});

// Update generation
updateGeneration(generation, {
  output: 'Hi there!',
});

// End generation
endGeneration(generation);

// Add score
score({
  traceId: trace.id,
  name: 'quality',
  value: 0.95,
});

// Flush and shutdown
await flushLangfuse();
await shutdownLangfuse();
```

## Types

### Core Message

```typescript
type CoreMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentPart[];
  name?: string;
  toolCallId?: string;
};
```

### StepResult

```typescript
interface StepResult {
  stepNumber: number;
  toolCalls: Array<{
    toolName: string;
    args: any;
    result: any;
  }>;
  text?: string;
  finishReason?: string;
}
```

### RunMetadata

```typescript
interface RunMetadata {
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  finishReason?: string;
  totalToolCalls?: number;
  handoffChain?: string[];
  agentMetrics?: AgentMetric[];
}
```

### AgentMetric

Per-agent metrics for multi-agent runs.

```typescript
interface AgentMetric {
  agentName: string;
  turns: number;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  toolCalls: number;
  duration: number; // milliseconds
}
```

### Type Utilities

Utility types for TypeScript development:

```typescript
import type {
  Expand,
  DeepPartial,
  SnakeToCamelCase,
  RequireKeys,
  OptionalKeys,
  KeysOfType,
  Prettify,
  Mutable,
  UnwrapPromise,
  ArrayElement,
} from '@tawk-agents-sdk/core';

// Expand - Expand intersection types for better IntelliSense
type Expanded = Expand<{ a: number } & { b: string }>;

// DeepPartial - Make all properties optional recursively
type PartialConfig = DeepPartial<AgentConfig>;

// SnakeToCamelCase - Convert snake_case to camelCase
type CamelCase = SnakeToCamelCase<'user_id'>; // 'userId'

// RequireKeys - Require specific keys
type Required = RequireKeys<AgentConfig, 'name' | 'model'>;

// OptionalKeys - Make specific keys optional
type Optional = OptionalKeys<AgentConfig, 'tools' | 'guardrails'>;

// KeysOfType - Get keys of a specific type
type StringKeys = KeysOfType<AgentConfig, string>;

// Prettify - Improve type display in IDE
type Pretty = Prettify<ComplexType>;

// Mutable - Make readonly properties mutable
type MutableConfig = Mutable<Readonly<AgentConfig>>;

// UnwrapPromise - Extract type from Promise
type Result = UnwrapPromise<Promise<string>>; // string

// ArrayElement - Get element type from array
type Item = ArrayElement<string[]>; // string
```

## Error Classes

### MaxTurnsExceededError

```typescript
class MaxTurnsExceededError extends Error {
  constructor(maxTurns: number, agentName: string);
}
```

### GuardrailTripwireTriggered

```typescript
class GuardrailTripwireTriggered extends Error {
  constructor(guardrailName: string, message: string);
  guardrailName: string;
}
```

### ToolExecutionError

```typescript
class ToolExecutionError extends Error {
  constructor(toolName: string, originalError: Error);
  toolName: string;
  originalError: Error;
}
```

### HandoffError

```typescript
class HandoffError extends Error {
  constructor(fromAgent: string, toAgent: string, reason: string);
  fromAgent: string;
  toAgent: string;
}
```

### ApprovalRequiredError

```typescript
class ApprovalRequiredError extends Error {
  constructor(toolName: string, args: any);
  toolName: string;
  args: any;
}
```

## Background Results

Handle long-running async operations that complete after the agent run finishes.

### backgroundResult()

Wrap a promise to indicate it's a background operation.

```typescript
function backgroundResult<T>(promise: Promise<T>): BackgroundResult<T>;
```

**Example:**
```typescript
import { backgroundResult } from '@tawk-agents-sdk/core';

const tool = tool({
  description: 'Send email',
  parameters: z.object({ to: z.string(), subject: z.string() }),
  execute: async ({ to, subject }) => {
    // Return background result for long-running operation
    return backgroundResult(
      sendEmailAsync(to, subject) // Returns Promise<void>
    );
  },
});
```

### isBackgroundResult()

Check if a value is a background result.

```typescript
function isBackgroundResult(value: any): value is BackgroundResult<any>;
```

**BackgroundResult Type:**
```typescript
class BackgroundResult<T> {
  readonly isBackground: true;
  promise: Promise<T>;
}
```

## Handoffs

Handoffs allow agents to delegate tasks to other specialized agents within your application. This enables multi-agent workflows where a coordinator agent routes tasks to domain experts.

### Handoff Class

```typescript
class Handoff<TContext = any, TOutput = string> {
  constructor(config: {
    agentName: string;
    agent: Agent<TContext, TOutput>;
    toolName: string;
    toolDescription: string;
    inputFilter?: HandoffInputFilter;
    isEnabled?: HandoffEnabledFunction<TContext>;
    onInvokeHandoff?: (context: RunContextWrapper<TContext>, args: string) => void | Promise<void>;
  });
}
```

**Example:**
```typescript
import { Handoff } from '@tawk-agents-sdk/core';

const handoff = new Handoff({
  agentName: 'Billing',
  agent: billingAgent,
  toolName: 'handoff_to_billing',
  toolDescription: 'Handoff to billing specialist',
  inputFilter: (data) => keepLastMessages(5)(data),
  isEnabled: (context) => context.userTier === 'premium',
});
```

### handoff() Function

Convenience function to create a handoff.

```typescript
function handoff<TContext, TOutput>(
  agentName: string,
  agent: Agent<TContext, TOutput>,
  toolName: string,
  toolDescription: string
): Handoff<TContext, TOutput>;
```

### getHandoff() Function

Get a handoff from an agent by tool name.

```typescript
function getHandoff<TContext, TOutput>(
  agent: Agent<TContext, TOutput>,
  toolName: string
): Handoff<TContext, TOutput> | undefined;
```

### Handoff Input Filters

Filter messages passed to the next agent during handoff.

**HandoffInputData Type:**
```typescript
interface HandoffInputData {
  inputHistory: any[];
  preHandoffItems: any[];
  newItems: any[];
  runContext?: RunContextWrapper<any>;
}
```

**HandoffInputFilter Type:**
```typescript
type HandoffInputFilter = (input: HandoffInputData) => HandoffInputData;
```

**Usage:**
```typescript
import {
  removeAllTools,
  keepLastMessages,
  keepLastMessage,
  keepMessagesOnly,
  createHandoffPrompt,
} from '@tawk-agents-sdk/core';

// Remove all tool calls from history
removeAllTools(inputData);

// Keep only last N messages
keepLastMessages(5)(inputData);

// Keep only the last message
keepLastMessage()(inputData);

// Keep only messages (remove tool calls)
keepMessagesOnly(inputData);

// Create a prompt describing available handoffs
const prompt = createHandoffPrompt([
  { name: 'Billing', handoffDescription: 'Handles payment and invoice issues' },
  { name: 'Technical', handoffDescription: 'Handles technical support' },
]);
```

## Tracing Context

Manage tracing context for multi-agent workflows.

### withTrace()

Wrap multiple agent runs in a single trace.

```typescript
function withTrace<T>(
  name: string,
  callback: (trace: any) => Promise<T>
): Promise<T>;
```

**Example:**
```typescript
import { withTrace, run } from '@tawk-agents-sdk/core';

await withTrace('Multi-Agent Workflow', async (trace) => {
  const result1 = await run(agent1, 'Research topic');
  const result2 = await run(agent2, result1.finalOutput);
  return result2;
});
```

### getCurrentTrace()

Get the current active trace.

```typescript
function getCurrentTrace(): any | null;
```

### getCurrentSpan()

Get the current active span.

```typescript
function getCurrentSpan(): any | null;
```

### setCurrentSpan()

Set the current active span.

```typescript
function setCurrentSpan(span: any): void;
```

### createContextualSpan()

Create a span within the current trace context.

```typescript
function createContextualSpan(
  name: string,
  callback: (span: any) => Promise<any>
): Promise<any>;
```

### createContextualGeneration()

Create a generation within the current trace context.

```typescript
function createContextualGeneration(
  options: {
    name: string;
    model: string;
    input: any;
    output?: any;
  },
  callback: (generation: any) => Promise<any>
): Promise<any>;
```

## Tracing Utilities

Wrapper functions for tracing tool execution, handoffs, and guardrails.

### withFunctionSpan()

Wrap a function execution with a tracing span.

```typescript
function withFunctionSpan<T>(
  trace: any,
  name: string,
  input: any,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T>;
```

**Example:**
```typescript
import { withFunctionSpan } from '@tawk-agents-sdk/core';

const result = await withFunctionSpan(
  trace,
  'getWeather',
  { location: 'Tokyo' },
  async () => {
    return await weatherTool.execute({ location: 'Tokyo' });
  },
  { toolType: 'api' }
);
```

### withHandoffSpan()

Wrap a handoff with a tracing span.

```typescript
function withHandoffSpan<T>(
  trace: any,
  fromAgent: string,
  toAgent: string,
  reason: string,
  fn: () => Promise<T>
): Promise<T>;
```

**Example:**
```typescript
import { withHandoffSpan } from '@tawk-agents-sdk/core';

const result = await withHandoffSpan(
  trace,
  'Support',
  'Billing',
  'Payment issue detected',
  async () => {
    return await billingAgent.run(input);
  }
);
```

### withGuardrailSpan()

Wrap a guardrail check with a tracing span.

```typescript
function withGuardrailSpan<T>(
  trace: any,
  guardrailName: string,
  input: any,
  fn: () => Promise<T>
): Promise<T>;
```

**Example:**
```typescript
import { withGuardrailSpan } from '@tawk-agents-sdk/core';

const result = await withGuardrailSpan(
  trace,
  'contentSafety',
  output,
  async () => {
    return await guardrail.validate(output);
  }
);
```

## Generic Tracing System

Low-level tracing system for custom observability integrations.

### TraceManager

Manage traces and callbacks.

```typescript
class TraceManager {
  setGlobalCallback(callback: TraceCallback): void;
  startTrace(options?: TraceOptions): Trace;
  getTrace(traceId: string): Trace | undefined;
  endTrace(traceId: string): void;
  clearAll(): void;
}
```

### getGlobalTraceManager()

Get the global trace manager instance.

```typescript
function getGlobalTraceManager(): TraceManager;
```

### setGlobalTraceCallback()

Set a global trace callback for all traces.

```typescript
function setGlobalTraceCallback(callback: TraceCallback): void;
```

### createLangfuseCallback()

Create a Langfuse callback for tracing.

```typescript
function createLangfuseCallback(langfuse: Langfuse): TraceCallback;
```

### createConsoleCallback()

Create a console callback for tracing (useful for debugging).

```typescript
function createConsoleCallback(verbose?: boolean): TraceCallback;
```

**Example:**
```typescript
import {
  getGlobalTraceManager,
  setGlobalTraceCallback,
  createConsoleCallback,
} from '@tawk-agents-sdk/core';

// Set console callback for debugging
setGlobalTraceCallback(createConsoleCallback(true));

// Or use Langfuse
import { Langfuse } from 'langfuse';
const langfuse = new Langfuse({ ... });
setGlobalTraceCallback(createLangfuseCallback(langfuse));
```

## MCP (Model Context Protocol)

Integrate external tools via the Model Context Protocol.

### MCPServerManager

Manage MCP servers and their tools.

```typescript
class MCPServerManager {
  registerServer(name: string, config: MCPServerConfig): Promise<void>;
  getTools(serverName?: string): Promise<MCPTool[]>;
  callTool(serverName: string, toolName: string, args: any): Promise<any>;
  shutdown(): Promise<void>;
}
```

**Example:**
```typescript
import { MCPServerManager } from '@tawk-agents-sdk/core';

const manager = new MCPServerManager();
await manager.registerServer('filesystem', {
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem'],
});

const tools = await manager.getTools('filesystem');
```

### getGlobalMCPManager()

Get the global MCP manager instance.

```typescript
function getGlobalMCPManager(): MCPServerManager;
```

### registerMCPServer()

Register an MCP server with the global manager.

```typescript
function registerMCPServer(
  name: string,
  config: MCPServerConfig
): Promise<void>;
```

### getMCPTools()

Get tools from registered MCP servers.

```typescript
function getMCPTools(serverName?: string): Promise<MCPTool[]>;
```

### shutdownMCPServers()

Shutdown all MCP servers.

```typescript
function shutdownMCPServers(): Promise<void>;
```

### MCP Utilities

```typescript
import {
  filterMCPTools,
  createMCPToolStaticFilter,
  mcpToFunctionTool,
  normalizeMCPToolName,
  groupMCPToolsByServer,
} from '@tawk-agents-sdk/core';

// Filter tools by criteria
const filtered = filterMCPTools(tools, {
  serverNames: ['filesystem'],
  toolNames: ['read_file'],
});

// Convert MCP tool to function tool
const functionTool = mcpToFunctionTool(mcpTool);

// Normalize tool names
const normalized = normalizeMCPToolName('read-file', 'filesystem');
// Returns: 'filesystem_read_file'

// Group tools by server
const grouped = groupMCPToolsByServer(tools);
```

**MCPToolFilter Type:**
```typescript
interface MCPToolFilter {
  serverNames?: string[];
  toolNames?: string[];
  excludeServerNames?: string[];
  excludeToolNames?: string[];
}
```

## Human-in-the-Loop (Approvals)

Require human approval before executing sensitive operations.

### ApprovalManager

Manage approval workflows.

```typescript
class ApprovalManager {
  constructor(config?: ApprovalConfig);
  requestApproval(
    toolName: string,
    args: any,
    metadata?: Record<string, any>
  ): Promise<ApprovalResponse>;
  getPendingApprovals(): PendingApproval[];
  approve(approvalId: string): void;
  reject(approvalId: string, reason?: string): void;
}
```

**Example:**
```typescript
import { ApprovalManager, createCLIApprovalHandler } from '@tawk-agents-sdk/core';

const manager = new ApprovalManager({
  requestApproval: createCLIApprovalHandler(),
});

const response = await manager.requestApproval('delete_user', { userId: '123' });
if (response.approved) {
  // Execute the operation
}
```

### getGlobalApprovalManager()

Get the global approval manager instance.

```typescript
function getGlobalApprovalManager(): ApprovalManager;
```

### Approval Handlers

#### createCLIApprovalHandler()

Create a CLI-based approval handler.

```typescript
function createCLIApprovalHandler(): ApprovalConfig['requestApproval'];
```

#### createWebhookApprovalHandler()

Create a webhook-based approval handler.

```typescript
function createWebhookApprovalHandler(
  webhookUrl: string,
  options?: {
    timeout?: number;
    headers?: Record<string, string>;
  }
): ApprovalConfig['requestApproval'];
```

#### createAutoApproveHandler()

Create an auto-approve handler (for testing).

```typescript
function createAutoApproveHandler(): ApprovalConfig['requestApproval'];
```

#### createAutoRejectHandler()

Create an auto-reject handler (for testing).

```typescript
function createAutoRejectHandler(): ApprovalConfig['requestApproval'];
```

## Usage Tracking

Track token usage and request counts.

### Usage Class

```typescript
class Usage {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;

  constructor(input?: {
    requests?: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    promptTokens?: number;      // AI SDK format
    completionTokens?: number;  // AI SDK format
  });

  add(newUsage: Usage): void;
  toJSON(): {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}
```

**Example:**
```typescript
import { Usage } from '@tawk-agents-sdk/core';

const usage = new Usage({
  promptTokens: 100,
  completionTokens: 50,
});

usage.add(new Usage({ inputTokens: 200, outputTokens: 100 }));
console.log(usage.totalTokens); // 250
```

## RunState

Manage the state of an agent run.

### RunState Class

```typescript
class RunState<TContext = any> {
  runContext?: RunContextWrapper<TContext>;
  currentAgent: Agent<any, any>;
  turnCount: number;
  originalInput: string | CoreMessage[];
  messages: CoreMessage[];
  items: RunItem[];
  usage: Usage;
  metadata: Record<string, any>;

  constructor(agent: Agent<any, any>, input: string | CoreMessage[]);
  
  addItem(item: RunItem): void;
  addMessage(message: CoreMessage): void;
  addUsage(newUsage: Usage): void;
  getHistory(): CoreMessage[];
  toJSON(): any;
}
```

### RunItem Types

```typescript
type RunItemType = 
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'handoff_call'
  | 'handoff_result'
  | 'guardrail_check';

interface RunItem {
  id: string;
  type: RunItemType;
  timestamp: number;
  agentName: string;
  metadata?: Record<string, any>;
}

interface RunMessageItem extends RunItem {
  type: 'message';
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RunToolCallItem extends RunItem {
  type: 'tool_call';
  toolName: string;
  args: any;
}

interface RunToolResultItem extends RunItem {
  type: 'tool_result';
  toolCallId: string;
  toolName: string;
  result: any;
  error?: string;
}

interface RunHandoffCallItem extends RunItem {
  type: 'handoff_call';
  fromAgent: string;
  toAgent: string;
  reason: string;
}

interface RunHandoffOutputItem extends RunItem {
  type: 'handoff_result';
  fromAgent: string;
  toAgent: string;
  success: boolean;
}

interface RunGuardrailItem extends RunItem {
  type: 'guardrail_check';
  guardrailName: string;
  passed: boolean;
  message?: string;
}

interface ModelResponse {
  agentName: string;
  stepNumber: number;
  text: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls: Array<{
    toolName: string;
    args: any;
  }>;
}
```

## Enhanced Results

Rich result types with additional properties.

### RunResult Class

Enhanced result with history, output, and metadata. This is the enhanced version exported as `EnhancedRunResult`.

```typescript
class RunResult<TContext = any, TAgent extends Agent<TContext, any> = Agent<any, any>> {
  constructor(state: RunState<TContext>);

  // The complete history (input + output)
  get history(): CoreMessage[];
  
  // The output messages generated during the run
  get output(): CoreMessage[];
  
  // The original input
  get input(): string | CoreMessage[];
  
  // All run items
  get items(): RunItem[];
  
  // Token usage
  get usage(): Usage;
  
  // Final output text
  get finalOutput(): string;
  
  // All messages
  get messages(): CoreMessage[];
  
  // Execution steps
  get steps(): StepResult[];
  
  // Metadata
  get metadata(): RunMetadata;
  
  // Run state
  get state(): RunState<TContext>;
}
```

**Note:** The enhanced `RunResult` is also exported as `EnhancedRunResult`:

```typescript
import { EnhancedRunResult } from '@tawk-agents-sdk/core';
```

### StreamedRunResult Class

Result from streaming execution.

```typescript
class StreamedRunResult<TContext = any, TAgent extends Agent<TContext, any> = Agent<any, any>> {
  constructor(state: RunState<TContext>);
  
  // Same properties as RunResult
  get history(): CoreMessage[];
  get output(): CoreMessage[];
  get input(): string | CoreMessage[];
  get items(): RunItem[];
  get usage(): Usage;
  get finalOutput(): string;
  get messages(): CoreMessage[];
  get steps(): StepResult[];
  get metadata(): RunMetadata;
  get state(): RunState<TContext>;
}
```

## Message Helpers

Utilities for creating and manipulating messages.

```typescript
import {
  user,
  assistant,
  system,
  toolMessage,
  getLastTextContent,
  filterMessagesByRole,
  extractAllText,
} from '@tawk-agents-sdk/core';

// Create messages
const userMsg = user('Hello!');
const assistantMsg = assistant('Hi there!');
const systemMsg = system('You are a helpful assistant.');
const toolMsg = toolMessage('Tool result', 'call-123');

// Get last text content
const lastText = getLastTextContent(messages);

// Filter by role
const userMessages = filterMessagesByRole(messages, 'user');

// Extract all text
const allText = extractAllText(messages);
```

## Safe Execution Utilities

Safely execute async functions with error handling and timeouts.

### safeExecute()

Safely execute an async function, catching any errors.

```typescript
function safeExecute<T>(
  fn: () => T | Promise<T>
): Promise<SafeExecuteResult<T>>;

type SafeExecuteResult<T> = [Error | unknown | null, T | null];
```

**Example:**
```typescript
import { safeExecute } from '@tawk-agents-sdk/core';

const [error, result] = await safeExecute(() => tool.execute(args));
if (error) {
  console.error('Tool failed:', error);
  return handleError(error);
}
return result;
```

### safeExecuteWithTimeout()

Safely execute with a timeout.

```typescript
function safeExecuteWithTimeout<T>(
  fn: () => T | Promise<T>,
  timeoutMs: number
): Promise<SafeExecuteResult<T>>;
```

**Example:**
```typescript
import { safeExecuteWithTimeout } from '@tawk-agents-sdk/core';

const [error, result] = await safeExecuteWithTimeout(
  () => tool.execute(args),
  5000 // 5 second timeout
);
if (error) {
  if (error instanceof Error && error.message.includes('timeout')) {
    console.error('Tool timed out');
  }
}
```

## Lifecycle Hooks

Subscribe to agent and run lifecycle events.

### AgentHooks

```typescript
class AgentHooks<TContext = any, TOutput = string> extends EventEmitter {
  on<K extends keyof AgentHookEvents<TContext, TOutput>>(
    event: K,
    listener: (data: AgentHookEvents<TContext, TOutput>[K]) => void
  ): this;
  
  emit<K extends keyof AgentHookEvents<TContext, TOutput>>(
    event: K,
    data: AgentHookEvents<TContext, TOutput>[K]
  ): boolean;
}

// Events
interface AgentHookEvents<TContext, TOutput> {
  'beforeRun': { input: string | CoreMessage[]; context?: TContext };
  'afterRun': { result: RunResult<TOutput> };
  'beforeStep': { stepNumber: number };
  'afterStep': { step: StepResult };
  'toolCall': { toolName: string; args: any };
  'toolResult': { toolName: string; result: any };
  'handoff': { fromAgent: string; toAgent: string };
  'error': { error: Error };
}
```

**Example:**
```typescript
agent.on('beforeRun', ({ input }) => {
  console.log('Starting run with:', input);
});

agent.on('toolCall', ({ toolName, args }) => {
  console.log(`Calling tool: ${toolName}`, args);
});
```

### RunHooks

```typescript
class RunHooks<TContext = any, TOutput = string> extends EventEmitter {
  // Same interface as AgentHooks
}

// Events
interface RunHookEvents<TContext, TOutput> {
  'stepStart': { stepNumber: number };
  'stepEnd': { step: StepResult };
  'streamChunk': { chunk: string };
  'complete': { result: RunResult<TOutput> };
  'error': { error: Error };
}
```

## Events

Stream events during agent execution.

### RunRawModelStreamEvent

Raw model streaming events.

```typescript
class RunRawModelStreamEvent {
  constructor(
    public readonly chunk: string,
    public readonly finishReason?: string
  );
}
```

### RunItemStreamEvent

Run item events.

```typescript
class RunItemStreamEvent {
  constructor(
    public readonly name: RunItemStreamEventName,
    public readonly item: RunItem
  );
}

type RunItemStreamEventName =
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'handoff_call'
  | 'handoff_result'
  | 'guardrail_check';
```

### RunAgentUpdatedStreamEvent

Agent update events.

```typescript
class RunAgentUpdatedStreamEvent {
  constructor(
    public readonly agentName: string,
    public readonly stepNumber: number
  );
}
```

### RunStreamEvent

Union type of all stream events.

```typescript
type RunStreamEvent =
  | RunRawModelStreamEvent
  | RunItemStreamEvent
  | RunAgentUpdatedStreamEvent;
```

## Session Auto-Summarization

Configure automatic conversation summarization to prevent token overflow.

### SummarizationConfig

```typescript
interface SummarizationConfig {
  enabled: boolean;
  messageThreshold: number;        // Summarize after N messages
  keepRecentMessages: number;       // Keep last N messages verbatim
  model?: LanguageModel;            // LLM for summarization (optional)
  summaryPrompt?: string;           // Custom prompt (optional)
}
```

**Example:**
```typescript
import { SessionManager } from '@tawk-agents-sdk/core';
import { openai } from '@ai-sdk/openai';

const sessionManager = new SessionManager({
  type: 'memory',
  summarization: {
    enabled: true,
    messageThreshold: 10,
    keepRecentMessages: 3,
    model: openai('gpt-4o-mini'),
  },
});
```

## Default Export

The SDK also exports `Agent` as the default export for convenience:

```typescript
import Agent from '@tawk-agents-sdk/core';

const agent = new Agent({
  name: 'Assistant',
  model: openai('gpt-4o'),
  instructions: 'You are helpful.',
});
```

## Version

Current version: `1.0.0`

```typescript
import { VERSION } from '@tawk-agents-sdk/core';
console.log(VERSION); // "1.0.0"
```

