# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Audio Processing**: Implemented debouncing mechanism (500ms) in `VoiceAgent.processAudio()` to prevent transcription fragmentation
  - Collects all audio chunks in buffer before processing
  - Only processes after 500ms of silence
  - Prevents multiple transcriptions per user input
  
- **Concurrency Control**: Added processing lock to prevent concurrent execution
  - `processingLock` prevents simultaneous `processBufferedAudio()` calls
  - Ensures only ONE transcription per user utterance
  - Fixes race conditions in audio processing
  
- **OpenAI Realtime API**: Increased transcription timeout from 1.5s to 3s
  - Allows more time for complete transcription
  - Better buffering of transcription fragments
  - Reduces fragmentation issues
  
- **Session Management**: Fixed memory leak in multi-turn conversations
  - Session history now maintains ~40 messages for 20 turns (expected)
  - Previously: 131,070 messages (memory explosion)
  - Prevents stack overflow crashes

- **Event Listeners**: Proper cleanup of event listeners
  - Prevents memory leaks in long-running sessions
  - Clears timeouts on interruption and stop

### Changed

- **Provider Architecture**: Maintained provider-agnostic design
  - Fixes work with ALL STT providers (Deepgram, OpenAI, AssemblyAI)
  - Fixes work with ALL TTS providers (ElevenLabs, Cartesia, OpenAI, etc.)
  - No provider-specific logic in core VoiceAgent class

### Performance

- Reduced response time from 30-45s to 10-15s per turn
- Eliminated unnecessary transcription API calls
- Better audio buffer management

## [1.0.0] - YYYY-MM-DD

### Added

- Initial release
- Multi-modal input (audio + text)
- Dual output (always text + audio)
- Multiple STT providers (Deepgram, OpenAI, AssemblyAI)
- Multiple TTS providers (ElevenLabs, Cartesia, OpenAI, Deepgram, Azure)
- agents-sdk integration as LLM layer
- Tool calling support
- Multi-agent handoffs
- Guardrails (content safety, PII detection)
- WebSocket and WebRTC transport
- Session management
- Langfuse tracing
- Event system (OpenAI Realtime-style)
- VAD (Voice Activity Detection)
- Interruption handling

---

## Version Notes

### Versioning Strategy

We use Semantic Versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking API changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Process

1. Update this CHANGELOG.md
2. Update version in package.json
3. Create git tag
4. Publish to NPM
5. Create GitHub release

---

## Migration Guides

### Upgrading from Pre-release to 1.0.0

No breaking changes. All existing code continues to work.

The debouncing and processing lock improvements are automatic and require no code changes.

---

## Contributor Credits

Thank you to all contributors who helped make this release possible!

---

## Roadmap

See [GitHub Issues](https://github.com/tawk/tawk-voice-agents-sdk/issues) for planned features and known issues.

### Upcoming Features

- [ ] Persistent WebSocket connection for STT (OpenAI Realtime API optimization)
- [ ] Additional STT providers (Azure, Google)
- [ ] Stream multiplexing for concurrent sessions
- [ ] Enhanced VAD algorithms
- [ ] Metrics dashboard
- [ ] Load balancing support
- [ ] Kubernetes deployment examples

---

For detailed commit history, see [GitHub Commits](https://github.com/tawk/tawk-voice-agents-sdk/commits/main).

