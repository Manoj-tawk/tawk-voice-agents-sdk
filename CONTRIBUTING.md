# Contributing to Tawk Voice Agents SDK

Thank you for your interest in contributing! This document provides guidelines for contributing to the Tawk Voice Agents SDK.

## Development Setup

### Prerequisites

- Node.js 18+ or 20+
- npm or pnpm
- TypeScript 5.0+

### Installation

```bash
# Clone the repository
git clone https://github.com/tawk/tawk-voice-agents-sdk.git
cd tawk-voice-agents-sdk

# Install dependencies
npm install

# Build the project
npm run build
```

## Project Structure

```
tawk-voice-agents-sdk/
├── src/                      # Source code
│   ├── voice-agent/          # Core VoiceAgent class
│   ├── providers/            # STT, TTS, VAD providers
│   ├── agents-sdk/           # LLM layer (Tawk Agents SDK integration)
│   ├── transport/            # WebSocket, WebRTC servers
│   ├── utils/                # Utility functions
│   └── types/                # TypeScript type definitions
├── examples/                 # Usage examples
├── dist/                     # Build output (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Write clean, readable code
- Follow existing code style
- Add TypeScript types for all new code
- Update documentation as needed

### 3. Test Your Changes

```bash
# Build
npm run build

# Run linter
npm run lint

# Run type check
npm run type-check
```

### 4. Commit

Use conventional commit messages:

```bash
git commit -m "feat: add new STT provider support"
git commit -m "fix: resolve audio buffer overflow"
git commit -m "docs: update API documentation"
```

### 5. Push and Create PR

```bash
git push origin feat/your-feature-name
```

Then create a Pull Request on GitHub.

## Code Style

### TypeScript

- Use TypeScript strict mode
- Provide explicit types for function parameters and return values
- Use interfaces for public APIs
- Use type aliases for complex types

### Naming Conventions

- **Classes**: PascalCase (`VoiceAgent`, `WebSocketServer`)
- **Functions**: camelCase (`processAudio`, `initialize`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_BUFFER_SIZE`)
- **Interfaces**: PascalCase with `I` prefix (`ISTTProvider`)
- **Types**: PascalCase (`VoiceAgentConfig`)

### Comments

- Use JSDoc for public APIs
- Add inline comments for complex logic
- Keep comments up-to-date with code changes

Example:

```typescript
/**
 * Process incoming audio data
 * 
 * @param audioData - Raw audio buffer (PCM16, 16kHz, mono)
 * @returns Promise that resolves when processing is complete
 */
async processAudio(audioData: Buffer): Promise<void> {
  // Implementation
}
```

## Adding New Providers

### STT Provider

1. Create new file in `src/providers/stt/`
2. Implement `STTProvider` interface
3. Add provider to `createSTTProvider` factory
4. Update documentation

### TTS Provider

1. Create new file in `src/providers/tts/`
2. Implement `TTSProvider` interface
3. Add provider to `createTTSProvider` factory
4. Update documentation

### Example

```typescript
// src/providers/stt/new-provider.ts
import { STTProvider } from '../types';

export class NewSTTProvider implements STTProvider {
  async initialize(): Promise<void> {
    // Setup connection
  }
  
  async transcribe(audio: Buffer): Promise<string> {
    // Transcribe audio
  }
  
  async stop(): Promise<void> {
    // Cleanup
  }
}
```

## Testing Guidelines

- Write tests for new features
- Ensure existing tests pass
- Test with multiple providers when applicable
- Include error handling tests

## Documentation

- Update README.md for new features
- Add JSDoc comments for public APIs
- Include code examples in documentation
- Update CHANGELOG.md

## Pull Request Guidelines

### PR Title

Use conventional commit format:

```
feat: add Anthropic Claude support
fix: resolve WebSocket connection timeout
docs: update provider configuration guide
```

### PR Description

Include:

1. **What** - Brief description of changes
2. **Why** - Reason for the change
3. **How** - Implementation approach
4. **Testing** - How you tested the changes
5. **Breaking Changes** - Any breaking changes (if applicable)

Example:

```markdown
## What
Adds support for Anthropic Claude models via agents-sdk

## Why
Users requested support for Claude for better reasoning capabilities

## How
- Added Claude model configuration to agents-sdk integration
- Updated type definitions
- Added example usage

## Testing
- Tested with Claude 3.5 Sonnet
- Verified tool calling works
- Tested handoffs between GPT-4 and Claude

## Breaking Changes
None
```

## Code Review Process

1. **Automated Checks**: CI must pass (build, lint, types)
2. **Manual Review**: Maintainer will review code
3. **Feedback**: Address review comments
4. **Approval**: Once approved, PR will be merged

## Questions?

- Open an issue for questions
- Email: support@tawk.to

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

