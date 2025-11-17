# Examples

Production-ready examples for the Voice Agent SDK.

## 🎙️ Main Examples

### 1. OpenAI All Models Server ⭐ **RECOMMENDED**

**File:** `openai-all-models-server.ts`

Complete production server demonstrating:
- All OpenAI models (GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo)
- Multi-modal input (audio + text)
- Dual output (always text + audio)
- Runtime model switching
- Tool calling (4 built-in tools)
- Session management with agents-sdk
- Real-time metrics

**Usage:**
```bash
# Start server
npx ts-node examples/openai-all-models-server.ts
```

**Key Features:**
- ✅ agents-sdk as LLM layer
- ✅ Full tool calling support
- ✅ Multi-agent handoffs
- ✅ Session persistence
- ✅ Production-ready error handling

---

### 2. Multi-Modal Agent

**File:** `multi-modal-agent.ts`

Demonstrates the core multi-modal capabilities:
- Audio OR text input
- ALWAYS text + audio output
- WebSocket server integration
- Tool calling with agents-sdk
- Session management

**Usage:**
```bash
npx ts-node examples/multi-modal-agent.ts
```

**Shows:**
- How to handle both audio and text input
- Dual output generation (text + audio)
- Provider flexibility (Deepgram, ElevenLabs, etc.)

---

### 3. Correct Architecture Demo

**File:** `correct-architecture.ts`

Shows the **correct way** to use agents-sdk as the LLM layer:
- ✅ agents-sdk IS the LLM (not a separate provider)
- ✅ No separate LLM provider abstraction needed
- ✅ Full agent orchestration built-in
- ✅ Tools, handoffs, guardrails via agents-sdk

**Usage:**
```bash
npx ts-node examples/correct-architecture.ts
```

**Important:** This is the recommended architecture pattern!

---

### 4. MediaSoup Integration

**File:** `mediasoup-integration.ts`

Pattern for integrating with MediaSoup media server:
- Server-to-server WebRTC
- Bidirectional audio streaming
- Real-time voice agent processing
- Low-latency design

**Use Cases:**
- Video conferencing platforms
- WebRTC applications
- Real-time collaboration tools

---

## 🌐 Browser Example

**File:** `browser.html`

Browser-based client example:
- WebSocket connection to Voice Agent SDK
- Audio recording from microphone
- Audio playback of agent responses
- Real-time bidirectional interaction

**Usage:**
```bash
# Serve with any HTTP server
npx http-server examples/
# Open http://localhost:8080/browser.html
```

---

## 🚀 Quick Start

**Recommended starting point:**

```bash
# Start the production server
npx ts-node examples/openai-all-models-server.ts
```

This example demonstrates all core features in a production-ready setup!

---

## 📖 Documentation

- **Main README:** `../README.md`
- **Contributing Guide:** `../CONTRIBUTING.md`
- **Changelog:** `../CHANGELOG.md`
- **API Reference:** `../docs/API.md` (if exists)

---

## 💡 Best Practices

### For Production Use

1. **Start with:** `openai-all-models-server.ts`
   - Production-ready template
   - All features demonstrated
   - Error handling included

2. **Learn from:** `correct-architecture.ts`
   - Shows proper agents-sdk usage
   - Correct provider pattern
   - Best practices

3. **Integrate with:** `mediasoup-integration.ts`
   - Real-world integration pattern
   - Server-to-server communication
   - WebRTC handling

### For Testing

- Use the examples as-is for manual testing
- Modify `multi-modal-agent.ts` for quick prototypes
- Reference `browser.html` for client-side integration

---

## 🔧 Configuration

All examples use environment variables:

```bash
# Required
OPENAI_API_KEY=your-key

# STT Provider (choose one)
DEEPGRAM_API_KEY=your-key
ASSEMBLYAI_API_KEY=your-key

# TTS Provider (choose one)
ELEVENLABS_API_KEY=your-key
CARTESIA_API_KEY=your-key
AZURE_TTS_KEY=your-key

# Optional
LANGFUSE_PUBLIC_KEY=your-key
LANGFUSE_SECRET_KEY=your-key
```

Create a `.env` file with these values or export them in your shell.

---

## 📝 Notes

- All examples are TypeScript and production-ready
- Examples use agents-sdk as the LLM layer (correct pattern)
- Provider flexibility: easily switch STT/TTS providers
- Examples include proper error handling and logging

---

## 🤝 Contributing

Found an issue or have an improvement? See `../CONTRIBUTING.md`

