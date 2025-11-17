# Auto-Summarization Feature

## Overview

The Auto-Summarization feature automatically compresses conversation history to prevent token overflow while preserving all important context. Instead of dropping old messages (sliding window), it creates intelligent summaries.

---

## How It Works

### **Before (Sliding Window):**
```
Messages: [msg1, msg2, msg3, msg4, msg5, msg6, msg7, msg8, msg9, msg10]
Limit reached → Drop oldest messages
Result: [msg6, msg7, msg8, msg9, msg10]
❌ Lost: All context from msg1-5
```

### **After (Auto-Summarization):**
```
Messages: [msg1, msg2, msg3, msg4, msg5, msg6, msg7, msg8, msg9, msg10]
Limit reached → Summarize old messages
Result: [SUMMARY_SYSTEM_MSG, msg8, msg9, msg10]
✅ Kept: All context in compressed form
✅ Stored: Summary as system message (hidden from users)
✅ Persisted: Works with all storage types (Memory, Redis, MongoDB, Hybrid)
```

### **Summary Storage**

Summaries are stored as **system messages** in the conversation history:

```typescript
{
  role: 'system',
  content: 'Previous conversation summary:\nUser is Alice, a software engineer...'
}
```

**Benefits:**
- ✅ **Hidden from users** - System role means UI can filter it out
- ✅ **Persisted in storage** - Works with Redis, MongoDB, etc.
- ✅ **Easy retrieval** - Just call `session.getHistory()`
- ✅ **Automatic context** - AI automatically sees the summary

---

## Configuration

```typescript
import { SessionManager } from '@tawk-agents-sdk/core';
import { openai } from '@ai-sdk/openai';

const sessionManager = new SessionManager({
  type: 'memory',
  summarization: {
    // Enable auto-summarization
    enabled: true,
    
    // Trigger summarization when message count exceeds this
    messageThreshold: 10,
    
    // Number of recent messages to keep verbatim
    keepRecentMessages: 3,
    
    // Model to use for summarization (optional)
    model: openai('gpt-4o-mini'),
    
    // Custom summary prompt (optional)
    summaryPrompt: 'Summarize focusing on user facts and context:',
  }
});
```

---

## Configuration Options

### `enabled` (boolean)
- **Default:** `false`
- **Description:** Enable/disable auto-summarization
- **Example:**
  ```typescript
  summarization: { enabled: true }
  ```

### `messageThreshold` (number)
- **Default:** `10`
- **Description:** Trigger summarization when message count exceeds this number
- **Example:**
  ```typescript
  summarization: {
    enabled: true,
    messageThreshold: 15, // Summarize after 15 messages
  }
  ```

### `keepRecentMessages` (number)
- **Default:** `3`
- **Description:** Number of recent messages to keep verbatim (not summarized)
- **Example:**
  ```typescript
  summarization: {
    enabled: true,
    messageThreshold: 10,
    keepRecentMessages: 5, // Keep last 5 messages unchanged
  }
  ```

### `model` (LanguageModelV1, optional)
- **Default:** `undefined` (uses simple text extraction)
- **Description:** LLM model to use for generating summaries
- **Example:**
  ```typescript
  import { openai } from '@ai-sdk/openai';
  
  summarization: {
    enabled: true,
    model: openai('gpt-4o-mini'), // Use GPT-4 for summaries
  }
  ```

### `summaryPrompt` (string, optional)
- **Default:** Built-in prompt focusing on user facts and context
- **Description:** Custom prompt for summary generation
- **Example:**
  ```typescript
  summarization: {
    enabled: true,
    model: openai('gpt-4o-mini'),
    summaryPrompt: `Summarize this conversation, focusing on:
      - User identity and background
      - Technical skills and expertise  
      - Current projects and goals
      - Important facts mentioned`,
  }
  ```

---

## Usage Examples

### Example 1: Simple Fallback (No LLM)

Best for: Simple applications, cost-sensitive scenarios

```typescript
const sessionManager = new SessionManager({
  type: 'memory',
  summarization: {
    enabled: true,
    messageThreshold: 10,
    keepRecentMessages: 3,
    // No model = uses text extraction fallback
  }
});

// Automatically extracts key facts from messages
// Fast, free, but less intelligent than LLM
```

### Example 2: LLM-Powered (Recommended)

Best for: Production applications, high-quality summaries

```typescript
import { openai } from '@ai-sdk/openai';

const sessionManager = new SessionManager({
  type: 'memory',
  summarization: {
    enabled: true,
    messageThreshold: 10,
    keepRecentMessages: 3,
    model: openai('gpt-4o-mini'), // Intelligent summarization
  }
});

// Generates high-quality summaries using LLM
// Better context preservation, small cost per summary
```

### Example 3: Aggressive Summarization

Best for: Very long conversations, tight token budgets

```typescript
const sessionManager = new SessionManager({
  type: 'memory',
  summarization: {
    enabled: true,
    messageThreshold: 5,  // Summarize early
    keepRecentMessages: 2, // Keep minimal recent context
    model: openai('gpt-4o-mini'),
  }
});

// Summarizes aggressively to save maximum tokens
```

### Example 4: Conservative Summarization

Best for: Short-medium conversations, prefer full context

```typescript
const sessionManager = new SessionManager({
  type: 'memory',
  summarization: {
    enabled: true,
    messageThreshold: 20,  // Summarize late
    keepRecentMessages: 10, // Keep lots of recent context
    model: openai('gpt-4o-mini'),
  }
});

// Keeps more verbatim messages, summarizes less often
```

### Example 5: Custom Domain-Specific Prompt

Best for: Specialized applications (medical, legal, etc.)

```typescript
const sessionManager = new SessionManager({
  type: 'memory',
  summarization: {
    enabled: true,
    messageThreshold: 10,
    keepRecentMessages: 3,
    model: openai('gpt-4o-mini'),
    summaryPrompt: `Summarize this medical consultation:
      - Patient information (name, age, conditions)
      - Symptoms discussed
      - Medications mentioned
      - Treatment plans
      - Follow-up requirements`,
  }
});
```

---

## How Summaries Are Generated

### With LLM Model (Recommended):

1. When message count > `messageThreshold`:
   - Take messages from index 0 to `-keepRecentMessages`
   - Send to LLM with summary prompt
   - Generate concise summary (max 500 tokens)
   - Replace old messages with summary

2. Summary includes previous summary:
   ```typescript
   // Turn 10: Summarizes messages 1-7
   Summary1: "User is Alice from Google..."
   
   // Turn 20: Summarizes messages 8-17 + previous summary
   Summary2: "User is Alice from Google... (from Summary1)
              Also discussed ML projects..."
   
   // Summaries build on each other
   ```

### Without LLM Model (Fallback):

1. Extracts sentences containing key patterns:
   - "I'm", "I am", "My name"
   - "I work", "I live", "I graduated"
   - Other fact-like patterns

2. Concatenates extracted facts

3. Less intelligent but free and fast

---

## Performance Impact

### Token Usage Comparison:

**Without Summarization (Sliding Window):**
```
Turn 10:  10 msgs × 200 tokens = 2,000 tokens
Turn 50:  10 msgs × 200 tokens = 2,000 tokens
Turn 100: 10 msgs × 200 tokens = 2,000 tokens

Fixed size, lost context ❌
```

**With Auto-Summarization:**
```
Turn 10:  Summary(500) + 3 msgs(600)  = 1,100 tokens
Turn 50:  Summary(800) + 3 msgs(600)  = 1,400 tokens
Turn 100: Summary(1.2K) + 3 msgs(600) = 1,800 tokens

Grows slowly, keeps all context ✅
```

### Cost Comparison (100-turn conversation):

**Without Summarization:**
- Tokens per turn: 2,000
- Total: 200,000 tokens
- Cost: ~$0.30 (at $1.50/1M tokens)
- Context loss: HIGH ❌

**With Summarization:**
- Average tokens per turn: ~1,500
- Summarization calls: ~10 × $0.001 = $0.01
- Total: 150,000 + summarization
- Cost: ~$0.24
- Context retention: 100% ✅

**Savings: 20-30% cost + perfect memory!**

---

## Best Practices

### 1. Choose Right Threshold

```typescript
// Short conversations (< 20 turns)
messageThreshold: 15-20

// Medium conversations (20-50 turns)
messageThreshold: 10-15

// Long conversations (> 50 turns)
messageThreshold: 5-10
```

### 2. Balance Recent Messages

```typescript
// High-context tasks (analysis, debugging)
keepRecentMessages: 5-10

// Normal tasks (chat, assistance)
keepRecentMessages: 3-5

// Low-context tasks (Q&A, search)
keepRecentMessages: 1-2
```

### 3. Use LLM for Production

```typescript
// Development/testing: Use fallback (free)
model: undefined

// Production: Use LLM (better quality)
model: openai('gpt-4o-mini')
```

### 4. Monitor Summary Quality

```typescript
// Log summaries to check quality
session.on('summarized', (summary) => {
  console.log('New summary:', summary);
  // Monitor if important facts are preserved
});
```

---

## Migration Guide

### From Sliding Window to Auto-Summarization:

**Before:**
```typescript
const sessionManager = new SessionManager({
  type: 'memory',
  maxMessages: 10, // Sliding window
});
```

**After:**
```typescript
const sessionManager = new SessionManager({
  type: 'memory',
  maxMessages: 10, // Fallback if summarization fails
  summarization: {
    enabled: true,
    messageThreshold: 10,
    keepRecentMessages: 3,
    model: openai('gpt-4o-mini'),
  }
});
```

**Benefits:**
- ✅ Same token usage
- ✅ Better context retention
- ✅ Seamless upgrade

---

## Troubleshooting

### Summary Too Long?

```typescript
// Reduce keepRecentMessages
keepRecentMessages: 2 // instead of 5

// Or summarize more aggressively  
messageThreshold: 5 // instead of 10
```

### Summary Losing Important Info?

```typescript
// Use custom prompt with specific instructions
summaryPrompt: `Summarize preserving:
  - User name, job, location
  - All technical skills mentioned
  - Current projects and goals
  - Important dates and numbers`

// Or keep more recent messages
keepRecentMessages: 5 // instead of 3
```

### Summarization Too Expensive?

```typescript
// Use fallback (no LLM)
model: undefined

// Or summarize less often
messageThreshold: 20 // instead of 10
```

### Summaries Not Working?

1. Check `enabled: true`
2. Ensure `messageThreshold` is reached
3. Verify model is provided (or fallback enabled)
4. Check console for errors

---

## API Reference

### SummarizationConfig Interface

```typescript
interface SummarizationConfig {
  /** Enable auto-summarization */
  enabled: boolean;
  
  /** Trigger summarization when message count exceeds this */
  messageThreshold: number;
  
  /** Number of recent messages to keep verbatim */
  keepRecentMessages: number;
  
  /** Model to use for summarization (optional) */
  model?: LanguageModelV1;
  
  /** System prompt for summarization (optional) */
  summaryPrompt?: string;
}
```

### Default Values

```typescript
{
  enabled: false,
  messageThreshold: 10,
  keepRecentMessages: 3,
  model: undefined,
  summaryPrompt: "Summarize the following conversation..."
}
```

---

## Examples in Practice

See the complete working examples in:
- `tests/16-auto-summarization.test.ts` - Configuration examples
- `tests/14-multi-model-handoff.test.ts` - Real-world usage

---

## Support

For questions or issues:
1. Check [GitHub Issues](https://github.com/Manoj-tawk/tawk-agents-sdk/issues)
2. Read [Core Concepts](./CORE_CONCEPTS.md)
3. See [API Documentation](./API.md)

