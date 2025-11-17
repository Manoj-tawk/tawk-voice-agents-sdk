# End-to-End (E2E) Tests

End-to-end tests that validate the SDK with real API calls, demonstrating actual functionality in production-like scenarios.

## Purpose

E2E tests serve three critical purposes:
1. **Validation** - Verify the SDK works correctly with real AI providers
2. **Documentation** - Show developers how features work in practice
3. **Debugging** - Test real API integration and identify issues

## Quick Start

```bash
# 1. Configure API key
echo "OPENAI_API_KEY=sk-your-key-here" > .env

# 2. Run E2E test
npm run e2e:basic

# 3. View real AI responses and metrics
```

## Available E2E Tests

### Test 01: Basic Features
```bash
npm run e2e:basic
```

**Coverage:**
- Simple agent queries
- Tool calling with calculator
- Context injection
- Multi-turn conversations
- Error handling

**Cost:** ~$0.001 (~500 tokens)

### Test 02: Multi-Agent Patterns
```bash
npm run e2e:multi
```

**Coverage:**
- Multi-agent handoffs
- Race agents (parallel execution)
- Fallback patterns
- Agent coordination

**Cost:** ~$0.002 (~1000 tokens)

### Test 03: Streaming & Sessions
```bash
npm run e2e:stream
```

**Coverage:**
- Real-time streaming responses
- Session memory persistence
- Multi-turn conversation context
- Conversation continuity

**Cost:** ~$0.002 (~1000 tokens)

## Requirements

### Essential
- `.env` file with `OPENAI_API_KEY`
- Network connection
- OpenAI API credits

### Optional
```env
# Langfuse tracing
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Other providers
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

## Example Output

```bash
$ npm run e2e:basic

🧪 E2E TEST 01: Basic Agent with Real API

📍 Test 1: Simple Question
✅ Agent: Simple Agent
📝 Response: 2+2 equals 4.
📊 Tokens used: 23
💰 Cost: ~$ 0.000004

📍 Test 2: Tool Calling
   🔧 Tool called: multiply(156, 23) = 3588
✅ Agent: Calculator Agent
📝 Response: 156 multiplied by 23 equals 3,588.
🔧 Tool calls: 1
📊 Tokens used: 87
💰 Cost: ~$ 0.000013

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL E2E TESTS PASSED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  Duration: 3.45s
💰 Total cost: ~$0.000842
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Cost Information

E2E tests make real API calls with associated costs:

- Test 01 (Basic): ~$0.001
- Test 02 (Multi-Agent): ~$0.002
- Test 03 (Streaming): ~$0.002

**Total for all tests: ~$0.005** (less than 1 cent)

Each test displays exact token usage and cost estimates.

## When to Use

### Use E2E Tests For:
- Validating features work with real APIs
- Demonstrating SDK functionality
- Learning how the SDK operates
- Debugging real API integration issues
- Pre-release validation

### Use Unit Tests For:
- Fast feedback during development
- CI/CD automated testing
- Zero-cost development
- Testing specific logic

### Use Integration Tests For:
- Comprehensive validation
- Deep feature testing
- Pre-release verification
- Full system validation

## Test Comparison

| Type | Speed | Cost | Network | Purpose |
|------|-------|------|---------|---------|
| **Unit** | ⚡ <1s | Free | ❌ No | Development |
| **E2E** | 🏃 3-5s | ~$0.005 | ✅ Yes | Validation |
| **Integration** | 🐌 30-60s | ~$0.05 | ✅ Yes | Full validation |

## Adding New E2E Tests

```typescript
// tests/e2e/04-my-feature-e2e.test.ts

import 'dotenv/config';
import { Agent, run } from '@tawk-agents-sdk/core';
import { openai } from '@ai-sdk/openai';

async function testMyFeature() {
  console.log('📍 Testing feature...');
  
  const agent = new Agent({
    name: 'Test Agent',
    instructions: 'Test instructions',
  });

  const result = await run(agent, 'Test input');
  
  console.log('✅ Result:', result.finalOutput);
  console.log('📊 Tokens:', result.metadata.totalTokens);
  
  return result;
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY required');
  process.exit(1);
}

testMyFeature();
```

Add to `package.json`:
```json
{
  "scripts": {
    "e2e:myfeature": "ts-node tests/e2e/04-my-feature-e2e.test.ts"
  }
}
```

## Best Practices

1. **Keep tests focused** - One feature per test file
2. **Display costs** - Show token usage and cost estimates
3. **Show real output** - Display actual AI responses
4. **Handle errors** - Check for API keys and handle failures gracefully
5. **Be descriptive** - Use clear logging to show test progress

## Support

- 📖 [Full Documentation](../../README.md)
- 💬 [GitHub Issues](https://github.com/Manoj-tawk/tawk-agents-sdk/issues)
- 📧 support@tawk.to
