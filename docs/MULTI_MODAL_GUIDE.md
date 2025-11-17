# Multi-Modal Guide

Complete guide to the multi-modal capabilities of Tawk Voice Agents SDK. Learn how to use this new SDK to handle both audio and text input with dual output.

## Overview

The Tawk Voice Agents SDK supports **two input modes** with **always dual output**:

```
INPUT MODES:
1. Audio Input  → STT → Tawk Agents SDK → TTS → Audio + Text Output
2. Text Input   →       Tawk Agents SDK → TTS → Audio + Text Output

OUTPUT: ALWAYS both Text AND Audio
```

**Key Point:** Even when you provide text input, audio output is ALWAYS generated via TTS.

---

## Input Modes

### 1. Audio Input Mode

**Flow:** `Audio → STT → Tawk Agents SDK → TTS → Audio + Text`

#### Usage

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';

const voiceAgent = new VoiceAgent({
  // ... config
});

await voiceAgent.initialize();

// Process audio buffer
const audioBuffer = Buffer.from(pcm16Data);
await voiceAgent.processAudio(audioBuffer);
```

#### What Happens

1. **Audio buffer received** - Raw audio data (PCM16, 16kHz, mono recommended)
2. **STT transcribes** - Converts speech → text (Deepgram/AssemblyAI/OpenAI)
3. **Tawk Agents SDK processes** - Runs agent with LLM, tools, handoffs, guardrails
4. **TTS synthesizes** - Converts response → audio (ElevenLabs/Cartesia/OpenAI/etc.)
5. **Output:** Text events + Audio chunks

#### Events Emitted

```typescript
voiceAgent.on('transcription', (text: string) => {
  // STT transcription complete
  console.log('User said:', text);
});

voiceAgent.on('response.text.delta', (delta: string) => {
  // Streaming text chunks
  process.stdout.write(delta);
});

voiceAgent.on('response.text', (text: string) => {
  // Complete text response
  console.log('Assistant:', text);
});

voiceAgent.on('audio.chunk', (chunk: Buffer) => {
  // Audio chunks ready for playback
  // Send to client for playback
});
```

---

### 2. Text Input Mode

**Flow:** `Text → Tawk Agents SDK → TTS → Audio + Text`

#### Usage

```typescript
// Process text directly (skip STT)
await voiceAgent.processText('What is the weather in Tokyo?');
```

#### What Happens

1. **Text received** - Input text directly (STT skipped)
2. **Tawk Agents SDK processes** - Runs agent with LLM, tools, handoffs, guardrails
3. **TTS synthesizes** - Converts response → audio
4. **Output:** Text events + Audio chunks

**Important:** Even with text input, audio is **ALWAYS** generated!

#### Events Emitted

Same events as audio input, except:
- `transcription` - Emits the input text (for consistency)
- `metrics.sttLatency` - Will be 0

---

## Complete Example

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';
import { WebSocketServer } from '@tawk/voice-agents-sdk/transport';
import { tool, MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';

// Create voice agent
const voiceAgent = new VoiceAgent({
  transport: { type: 'websocket' },
  
  // STT for audio input
  stt: {
    provider: 'deepgram',
    apiKey: process.env.DEEPGRAM_API_KEY!,
  },
  
  // Tawk Agents SDK (LLM layer)
  agent: {
    model: openai('gpt-4o'),
    instructions: 'You are helpful. Be concise for voice.',
    session: new MemorySession('session-1'),
  },
  
  // TTS for audio output (ALWAYS used)
  tts: {
    provider: 'elevenlabs',
    apiKey: process.env.ELEVENLABS_API_KEY!,
    voiceId: process.env.ELEVENLABS_VOICE_ID!,
  },
});

await voiceAgent.initialize();

// Handle both input modes
const wsServer = new WebSocketServer({ port: 8080 });

wsServer.on('connection', async (connection, sessionId) => {
  // Handle audio input
  connection.on('audio-data', async (audio: Buffer) => {
    await voiceAgent.processAudio(audio);
  });
  
  // Handle text input
  connection.on('message', async (message: any) => {
    if (message.type === 'text') {
      await voiceAgent.processText(message.text);
    }
  });
  
  // Send audio output (ALWAYS generated)
  voiceAgent.on('audio.chunk', (chunk: Buffer) => {
    connection.sendAudio(chunk);
  });
  
  // Send text output (ALWAYS generated)
  voiceAgent.on('response.text', (text: string) => {
    connection.sendEvent({
      type: 'response.text',
      text,
    });
  });
});
```

---

## Dual Output Details

### Why Always Dual Output?

1. **Transcription included** - Text output provides transcription
2. **Better debugging** - See what was said/generated
3. **Text-based analytics** - Analyze conversations
4. **Accessibility** - Support text-only interfaces
5. **Consistency** - Same output format regardless of input

### Text Output Events

```typescript
// Streaming text (real-time)
voiceAgent.on('response.text.delta', (delta: string) => {
  // Append to UI
  textArea.value += delta;
});

// Complete text (when done)
voiceAgent.on('response.text', (text: string) => {
  // Full response available
  console.log('Complete response:', text);
});
```

### Audio Output Events

```typescript
// Audio chunks (for playback)
voiceAgent.on('audio.chunk', (chunk: Buffer) => {
  // Send to audio player
  audioPlayer.write(chunk);
});

// Audio started
voiceAgent.on('audio.started', (sentence: string) => {
  console.log('Synthesizing:', sentence);
});

// Audio ended
voiceAgent.on('audio.ended', (sentence: string) => {
  console.log('Finished:', sentence);
});
```

---

## Audio Format Requirements

### Recommended Format

- **Encoding:** PCM16 (16-bit PCM)
- **Sample Rate:** 16kHz
- **Channels:** Mono (1 channel)
- **Byte Order:** Little-endian

### Format Conversion

If your audio is in a different format, convert it before processing:

```typescript
import { AudioConverter } from '@tawk/voice-agents-sdk/utils';

const converter = new AudioConverter({
  inputFormat: 'opus',
  outputFormat: 'pcm16',
  sampleRate: 48000,
  outputSampleRate: 16000,
});

const pcm16Audio = await converter.convert(opusAudio);
await voiceAgent.processAudio(pcm16Audio);
```

---

## Use Cases

### 1. Voice-Only Interface

```typescript
// Only handle audio input
connection.on('audio-data', async (audio) => {
  await voiceAgent.processAudio(audio);
});

// Still get text output for logging/analytics
voiceAgent.on('response.text', (text) => {
  logger.info('Response:', text);
});
```

### 2. Chat Interface

```typescript
// Handle text input
connection.on('message', async (message) => {
  if (message.type === 'text') {
    await voiceAgent.processText(message.text);
  }
});

// Still get audio output for voice playback
voiceAgent.on('audio.chunk', (chunk) => {
  // Play audio in chat interface
});
```

### 3. Hybrid Interface

```typescript
// Handle both input types
connection.on('audio-data', async (audio) => {
  await voiceAgent.processAudio(audio);
});

connection.on('message', async (message) => {
  if (message.type === 'text') {
    await voiceAgent.processText(message.text);
  }
});

// Handle both output types
voiceAgent.on('response.text', (text) => {
  // Display in chat
});

voiceAgent.on('audio.chunk', (chunk) => {
  // Play audio
});
```

---

## Performance Considerations

### Audio Input

- **Debouncing:** VoiceAgent automatically debounces audio (500ms)
- **Buffering:** Audio chunks are buffered before processing
- **VAD:** Optional voice activity detection to filter silence

### Text Input

- **No STT:** Text input skips STT, reducing latency
- **Faster:** ~200ms faster than audio input
- **Same output:** Still generates audio + text

### Latency Comparison

| Input Type | STT Latency | Total Latency |
|------------|-------------|---------------|
| Audio      | ~200ms      | ~800ms        |
| Text       | 0ms         | ~600ms        |

---

## Event Flow Diagram

### Audio Input Flow

```
Audio Input
    ↓
processAudio()
    ↓
[Debounce 500ms]
    ↓
STT Provider
    ↓
transcription event
    ↓
Tawk Agents SDK
    ↓
response.text.delta events (streaming)
    ↓
response.text event (complete)
    ↓
TTS Provider
    ↓
audio.chunk events (streaming)
    ↓
audio.ended event
```

### Text Input Flow

```
Text Input
    ↓
processText()
    ↓
transcription event (input text)
    ↓
Tawk Agents SDK
    ↓
response.text.delta events (streaming)
    ↓
response.text event (complete)
    ↓
TTS Provider
    ↓
audio.chunk events (streaming)
    ↓
audio.ended event
```

---

## Best Practices

### 1. Always Handle Both Outputs

```typescript
// Handle text output
voiceAgent.on('response.text', (text) => {
  // Store for analytics
  analytics.track('response', { text });
});

// Handle audio output
voiceAgent.on('audio.chunk', (chunk) => {
  // Play audio
  audioPlayer.write(chunk);
});
```

### 2. Use Appropriate Input Mode

```typescript
// Use audio input for voice interfaces
if (hasMicrophone) {
  await voiceAgent.processAudio(audio);
}

// Use text input for chat interfaces
if (hasTextInput) {
  await voiceAgent.processText(text);
}
```

### 3. Handle Errors

```typescript
voiceAgent.on('error', (error) => {
  console.error('Error:', error);
  // Handle gracefully
});
```

### 4. Monitor Metrics

```typescript
voiceAgent.on('metrics', (metrics) => {
  console.log('Latency:', metrics.totalLatency, 'ms');
  console.log('STT:', metrics.sttLatency, 'ms');
  console.log('LLM:', metrics.llmLatency, 'ms');
  console.log('TTS:', metrics.ttsLatency, 'ms');
});
```

---

## How to Test

### Testing Audio Input

```typescript
import { VoiceAgent } from '@tawk/voice-agents-sdk/core';

describe('Audio Input', () => {
  it('should process audio and emit events', async () => {
    const voiceAgent = new VoiceAgent({ /* config */ });
    await voiceAgent.initialize();

    const transcriptions: string[] = [];
    const responses: string[] = [];
    const audioChunks: Buffer[] = [];

    voiceAgent.on('transcription', (text) => {
      transcriptions.push(text);
    });

    voiceAgent.on('response.text', (text) => {
      responses.push(text);
    });

    voiceAgent.on('audio.chunk', (chunk) => {
      audioChunks.push(chunk);
    });

    const audioBuffer = Buffer.from(/* PCM16 audio data */);
    await voiceAgent.processAudio(audioBuffer);

    expect(transcriptions.length).toBeGreaterThan(0);
    expect(responses.length).toBeGreaterThan(0);
    expect(audioChunks.length).toBeGreaterThan(0);
  });
});
```

### Testing Text Input

```typescript
describe('Text Input', () => {
  it('should process text and generate audio', async () => {
    const voiceAgent = new VoiceAgent({ /* config */ });
    await voiceAgent.initialize();

    const responses: string[] = [];
    const audioChunks: Buffer[] = [];

    voiceAgent.on('response.text', (text) => {
      responses.push(text);
    });

    voiceAgent.on('audio.chunk', (chunk) => {
      audioChunks.push(chunk);
    });

    await voiceAgent.processText('Hello, how are you?');

    // Verify text response
    expect(responses.length).toBeGreaterThan(0);
    
    // Verify audio was generated (dual output)
    expect(audioChunks.length).toBeGreaterThan(0);
  });
});
```

### Testing Dual Output

```typescript
describe('Dual Output', () => {
  it('should always generate both text and audio', async () => {
    const voiceAgent = new VoiceAgent({ /* config */ });
    await voiceAgent.initialize();

    let textReceived = false;
    let audioReceived = false;

    voiceAgent.on('response.text', () => {
      textReceived = true;
    });

    voiceAgent.on('audio.chunk', () => {
      audioReceived = true;
    });

    // Test with text input
    await voiceAgent.processText('Test');
    
    expect(textReceived).toBe(true);
    expect(audioReceived).toBe(true);
  });
});
```

---

## Troubleshooting

### Audio Not Processing

- Check audio format (PCM16, 16kHz, mono)
- Verify STT provider API key
- Enable debug logging: `logging: { level: 'debug' }`

### No Audio Output

- Check TTS provider API key
- Verify voiceId is valid
- Ensure `audio.chunk` event listener is set up

### Text Input Not Working

- Verify `processText()` is called correctly
- Check that agent is initialized
- Ensure event listeners are set up

---

## See Also

- [API Reference](./API.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [Architecture Guide](./ARCHITECTURE.md)
