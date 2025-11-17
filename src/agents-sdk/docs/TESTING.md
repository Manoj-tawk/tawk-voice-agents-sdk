# Testing Guide

## Quick Start

### Prerequisites

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

3. **Run all tests:**
   ```bash
   npm test
   ```

## Environment Setup

### Required API Keys

```bash
# OpenAI (Required for most tests)
OPENAI_API_KEY=sk-...

# Langfuse (Required for tracing tests)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

### Optional API Keys

```bash
# For testing multiple providers
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

## Running Tests

### Run All Tests
```bash
npm test
# or
./run-tests.sh
```

### Run Individual Tests
```bash
# Basic functionality
npx ts-node tests/01-basic-agent.test.ts

# Multi-agent coordination
npx ts-node tests/02-multi-agent.test.ts

# Streaming responses
npx ts-node tests/03-streaming.test.ts

# Guardrails & safety
npx ts-node tests/04-guardrails.test.ts

# Session management
npx ts-node tests/05-sessions.test.ts

# Langfuse tracing
npx ts-node tests/06-langfuse-tracing.test.ts

# Advanced tool calling patterns
npx ts-node tests/07-advanced-tool-calling.test.ts

# Race agents pattern
npx ts-node tests/08-race-agents.test.ts
```

## Test Coverage

### Core Features

| Test File | Coverage | What It Tests |
|-----------|----------|---------------|
| `01-basic-agent.test.ts` | Basic Agent | Tool calling, context injection, basic workflows |
| `02-multi-agent.test.ts` | Multi-Agent | Agent handoffs, specialized agents, coordination |
| `03-streaming.test.ts` | Streaming | Real-time responses, token streaming |
| `04-guardrails.test.ts` | Safety | Input validation, PII detection, content safety |
| `05-sessions.test.ts` | Sessions | Memory management, conversation history |
| `06-langfuse-tracing.test.ts` | Observability | Automatic tracing, spans, generations |
| `07-advanced-tool-calling.test.ts` | Advanced Tools | Sequential and parallel tool execution patterns |
| `08-race-agents.test.ts` | Race Pattern | Parallel agent execution, fallback patterns, performance |

### Test Scenarios

**Test 01: Basic Agent**
- Simple agent creation
- Tool calling
- Token tracking
- Context passing

**Test 02: Multi-Agent**
- Agent handoffs
- Coordinator patterns
- Specialized agents
- Hierarchical tracing

**Test 03: Streaming**
- Real-time text streaming
- Token-by-token output
- Stream interruption handling

**Test 04: Guardrails**
- Content safety validation
- PII detection
- Input/output filtering
- Custom guardrails

**Test 05: Sessions**
- Memory storage
- Conversation continuity
- Multiple turns
- Session management

**Test 06: Langfuse Tracing**
- Automatic trace creation
- Span generation
- Token usage tracking
- Trace visualization

**Test 07: Advanced Tool Calling**
- Sequential tool execution
- Parallel tool calls
- Tool result dependencies
- Complex workflows

**Test 08: Race Agents**
- Multiple agents racing in parallel
- Fallback patterns with primary/backup
- Performance optimization
- Error handling when all agents fail
- Context passing in races
- Tool usage in racing agents

## Expected Results

### Success Criteria

✅ All tests should pass with:
- Function calls execute correctly
- Context is passed to tools automatically
- Token usage is tracked
- Langfuse traces are created
- No errors or warnings

### Performance Benchmarks

- **Average response time**: < 500ms
- **Streaming latency**: < 100ms first token
- **Context injection overhead**: < 5ms
- **Concurrent requests**: 10+ simultaneous

## Troubleshooting

### Common Issues

1. **Missing API Key**
   ```
   Error: OPENAI_API_KEY not found
   ```
   **Solution**: Add API key to `.env` file

2. **Langfuse Connection Failed**
   ```
   Error: Failed to connect to Langfuse
   ```
   **Solution**: Check `LANGFUSE_BASE_URL` and keys

3. **Context Not Available in Tools**
   ```
   Error: Cannot read properties of undefined
   ```
   **Solution**: Ensure using SDK version with context injection fix

4. **Rate Limits**
   ```
   Error: Rate limit exceeded
   ```
   **Solution**: Add delay between tests or use different API key tier

## Continuous Integration

### GitHub Actions

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          LANGFUSE_PUBLIC_KEY: ${{ secrets.LANGFUSE_PUBLIC_KEY }}
          LANGFUSE_SECRET_KEY: ${{ secrets.LANGFUSE_SECRET_KEY }}
```

## Writing New Tests

### Template

```typescript
import { Agent, run, setDefaultModel } from '@tawk-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

setDefaultModel(openai('gpt-4o-mini'));

async function testNewFeature() {
  console.log('🧪 Testing: New Feature');
  
  try {
    // Your test code here
    
    console.log('✅ Test passed');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

testNewFeature();
```

### Best Practices

1. **Use descriptive test names**
2. **Test one feature per file**
3. **Include error cases**
4. **Verify token usage**
5. **Check Langfuse traces**
6. **Clean up resources**

## Support

For issues or questions:
- 📖 Read the [API Documentation](./API.md)
- 💬 Open an issue on GitHub
- 📧 Contact support

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on adding new tests.
