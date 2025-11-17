# Integration Tests

These are the original integration tests that make real API calls.

To run these tests, you need:
- Real API keys in `.env`
- Network connection
- Time (they're slow)

## Running Integration Tests

```bash
# Run individual integration tests
ts-node tests/integration/02-multi-agent.test.ts
ts-node tests/integration/03-streaming.test.ts
# etc...
```

## Unit Tests vs Integration Tests

The main `/tests` directory contains **unit tests** (fast, mocked, no API calls).

This `/tests/integration` directory contains **integration tests** (slow, real API calls).

Use unit tests for development and CI/CD.  
Use integration tests for validation before releases.

