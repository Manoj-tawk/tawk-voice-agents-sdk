# Tawk Agents SDK - Test Suite

Comprehensive test suite with unit tests, E2E tests, and integration tests.

## Test Architecture

The SDK includes three types of tests for comprehensive quality assurance:

### Unit Tests (`/tests/*.test.ts`)
- **Speed**: <1 second for all tests
- **Requirements**: None (no API keys needed)
- **Responses**: Mocked
- **Results**: Deterministic
- **Use Case**: Development and CI/CD

### E2E Tests (`/tests/e2e/*.test.ts`)
- **Speed**: 3-5 seconds per test
- **Requirements**: API keys required
- **Responses**: Real API calls
- **Cost**: ~$0.005 for all tests
- **Use Case**: Validation and learning

### Integration Tests (`/tests/integration/*.test.ts`)
- **Speed**: 30-60 seconds
- **Requirements**: API keys required
- **Responses**: Real API calls
- **Cost**: ~$0.05 for all tests
- **Use Case**: Pre-release validation

## Quick Start

```bash
# Run unit tests (fast, no API keys)
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific unit test
npm run test:basic

# Run E2E tests (requires API keys)
npm run e2e:basic
npm run e2e:multi
npm run e2e:stream
```

## Unit Tests

### Available Tests

**01-basic-agent.test.ts** - 10 passing tests
- Agent creation and configuration (3 tests)
- Basic execution (2 tests)
- Tool calling (1 test)
- Context injection (1 test)
- Token tracking (1 test)
- Error handling (2 tests)

### Running Unit Tests

```bash
# All unit tests
npm test

# Specific test file
npm run test:basic
npm run test:multi
npm run test:stream
npm run test:guards
npm run test:sessions
npm run test:langfuse
npm run test:advanced
npm run test:race

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Writing Unit Tests

```typescript
import { Agent, run } from '@tawk-agents-sdk/core';
import { generateText } from 'ai';
import { mockTextResponse } from './helpers';

jest.mock('ai');
const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;

describe('Feature Name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should behave correctly', async () => {
    // Mock the AI response
    mockGenerateText.mockResolvedValue(
      mockTextResponse('Expected output', { prompt: 10, completion: 5 })
    );

    // Create and test agent
    const agent = new Agent({
      name: 'Test Agent',
      instructions: 'Test instructions',
    });

    const result = await run(agent, 'Test input');

    // Assertions
    expect(result.finalOutput).toBe('Expected output');
    expect(result.metadata.totalTokens).toBe(15);
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });
});
```

### Test Utilities

The `/tests/helpers.ts` file provides utilities for mocking:

- `mockTextResponse()` - Mock simple text responses
- `mockToolCallResponse()` - Mock responses with tool calls
- `createMockModel()` - Create mock language models
- `createMockStream()` - Mock streaming responses

## E2E Tests

E2E tests make real API calls to validate the SDK works correctly in production scenarios.

### Available E2E Tests

**01-basic-e2e.test.ts** - Basic features
- Simple questions
- Tool calling
- Context injection
- Multi-turn conversations
- Error handling

**02-multi-agent-e2e.test.ts** - Multi-agent patterns
- Multi-agent handoffs
- Race agents (parallel execution)
- Fallback patterns

**03-streaming-sessions-e2e.test.ts** - Streaming and sessions
- Real-time streaming
- Session memory
- Multi-turn with context

### Running E2E Tests

```bash
# Set up API key
echo "OPENAI_API_KEY=sk-your-key" > .env

# Run E2E tests
npm run e2e:basic   # ~$0.001
npm run e2e:multi   # ~$0.002
npm run e2e:stream  # ~$0.002

# Run all E2E tests
npm run e2e         # ~$0.005 total
```

### E2E Test Output

```bash
$ npm run e2e:basic

🧪 E2E TEST 01: Basic Agent with Real API

📍 Test 1: Simple Question
✅ Agent: Simple Agent
📝 Response: 2 + 2 equals 4.
📊 Tokens used: 37
💰 Cost: ~$ 0.000006

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL E2E TESTS PASSED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  Duration: 10.35s
💰 Total cost: ~$0.000110
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Integration Tests

Integration tests are located in `/tests/integration/` and require real API credentials.

### Running Integration Tests

```bash
# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Run specific integration test
ts-node tests/integration/02-multi-agent.test.ts
ts-node tests/integration/03-streaming.test.ts
ts-node tests/integration/04-guardrails.test.ts
ts-node tests/integration/05-sessions.test.ts
ts-node tests/integration/06-langfuse-tracing.test.ts
ts-node tests/integration/07-advanced-tool-calling.test.ts
ts-node tests/integration/08-race-agents.test.ts
```

## Test Comparison

| Type | Speed | Cost | Network | API Keys | Purpose |
|------|-------|------|---------|----------|---------|
| **Unit** | ⚡ <1s | Free | ❌ No | ❌ No | Development & CI/CD |
| **E2E** | 🏃 3-5s | ~$0.005 | ✅ Yes | ✅ Yes | Validation & demos |
| **Integration** | 🐌 30-60s | ~$0.05 | ✅ Yes | ✅ Yes | Pre-release validation |

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Coverage Reports

Generate and view test coverage:

```bash
npm run test:coverage
```

Coverage report is generated at: `coverage/index.html`

## Best Practices

### For Development
1. Run unit tests frequently (`npm test`)
2. Use watch mode during development (`npm run test:watch`)
3. Aim for high coverage (>80%)

### For Validation
1. Run E2E tests before commits (`npm run e2e`)
2. Validate real API integration works
3. Check performance and token usage

### For Release
1. Run all unit tests (`npm test`)
2. Run all E2E tests (`npm run e2e`)
3. Run integration tests for comprehensive validation
4. Verify coverage meets requirements

## Support

- 📖 [Full Documentation](../README.md)
- 💬 [GitHub Issues](https://github.com/Manoj-tawk/tawk-agents-sdk/issues)
- 📧 support@tawk.to
