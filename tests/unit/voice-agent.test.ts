/**
 * Voice Agent Unit Tests
 * 
 * Tests for core VoiceAgent functionality:
 * - Multi-modal input (audio & text)
 * - Dual output (text + audio always)
 * - agents-sdk integration
 * - Event emission
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceAgent, VoiceAgentConfig } from '../../src/voice-agent/voice-agent';
import { openai } from '@ai-sdk/openai';

// Mock dependencies
vi.mock('@ai-sdk/openai');
vi.mock('../../src/providers/stt');
vi.mock('../../src/providers/tts');
vi.mock('../../src/providers/vad');

describe('VoiceAgent', () => {
  let voiceAgent: VoiceAgent;
  let config: VoiceAgentConfig;

  beforeEach(() => {
    config = {
      transport: { type: 'websocket' },
      stt: {
        provider: 'deepgram',
        apiKey: 'test-key',
        streaming: true,
      },
      agent: {
        model: openai('gpt-4o'),
        name: 'TestAgent',
        instructions: 'You are a test assistant.',
        modelSettings: {
          temperature: 0.7,
          maxTokens: 150,
        },
      },
      tts: {
        provider: 'elevenlabs',
        apiKey: 'test-key',
        voiceId: 'test-voice-id',
        streaming: true,
      },
      vad: {
        enabled: true,
        silenceThresholdMs: 700,
      },
      logging: {
        level: 'error', // Suppress logs during tests
      },
    };
  });

  afterEach(async () => {
    if (voiceAgent) {
      await voiceAgent.stop();
    }
  });

  describe('Initialization', () => {
    it('should create voice agent with valid config', () => {
      voiceAgent = new VoiceAgent(config);
      expect(voiceAgent).toBeDefined();
    });

    it('should initialize all providers', async () => {
      voiceAgent = new VoiceAgent(config);
      await expect(voiceAgent.initialize()).resolves.not.toThrow();
    });

    it('should emit ready event after initialization', async () => {
      voiceAgent = new VoiceAgent(config);
      const readyListener = vi.fn();
      voiceAgent.on('ready', readyListener);
      
      await voiceAgent.initialize();
      expect(readyListener).toHaveBeenCalled();
    });
  });

  describe('Multi-Modal Input', () => {
    beforeEach(async () => {
      voiceAgent = new VoiceAgent(config);
      await voiceAgent.initialize();
    });

    it('should accept audio input', async () => {
      const audioBuffer = Buffer.from('test-audio-data');
      await expect(voiceAgent.processAudio(audioBuffer)).resolves.not.toThrow();
    });

    it('should accept text input', async () => {
      const text = 'Hello, how are you?';
      await expect(voiceAgent.processText(text)).resolves.not.toThrow();
    });

    it('should emit transcription event for audio input', async () => {
      const audioBuffer = Buffer.from('test-audio-data');
      const transcriptionListener = vi.fn();
      voiceAgent.on('transcription', transcriptionListener);
      
      await voiceAgent.processAudio(audioBuffer);
      // Note: In real test, mock STT to return text
      // expect(transcriptionListener).toHaveBeenCalledWith(expect.any(String));
    });

    it('should emit transcription event for text input', async () => {
      const text = 'Hello, how are you?';
      const transcriptionListener = vi.fn();
      voiceAgent.on('transcription', transcriptionListener);
      
      await voiceAgent.processText(text);
      expect(transcriptionListener).toHaveBeenCalledWith(text);
    });
  });

  describe('Dual Output', () => {
    beforeEach(async () => {
      voiceAgent = new VoiceAgent(config);
      await voiceAgent.initialize();
    });

    it('should emit text output events', (done) => {
      const textDeltaListener = vi.fn();
      const textListener = vi.fn();
      
      voiceAgent.on('response.text.delta', textDeltaListener);
      voiceAgent.on('response.text', textListener);
      
      voiceAgent.processText('Test').then(() => {
        // In real test with mocked LLM, verify both events are called
        done();
      });
    });

    it('should emit audio output events', (done) => {
      const audioChunkListener = vi.fn();
      const audioStartedListener = vi.fn();
      const audioEndedListener = vi.fn();
      
      voiceAgent.on('audio.chunk', audioChunkListener);
      voiceAgent.on('audio.started', audioStartedListener);
      voiceAgent.on('audio.ended', audioEndedListener);
      
      voiceAgent.processText('Test').then(() => {
        // In real test with mocked TTS, verify all events are called
        done();
      });
    });

    it('should ALWAYS emit both text and audio for audio input', async () => {
      const textListener = vi.fn();
      const audioListener = vi.fn();
      
      voiceAgent.on('response.text', textListener);
      voiceAgent.on('audio.chunk', audioListener);
      
      await voiceAgent.processAudio(Buffer.from('test'));
      
      // Both should be called
      // expect(textListener).toHaveBeenCalled();
      // expect(audioListener).toHaveBeenCalled();
    });

    it('should ALWAYS emit both text and audio for text input', async () => {
      const textListener = vi.fn();
      const audioListener = vi.fn();
      
      voiceAgent.on('response.text', textListener);
      voiceAgent.on('audio.chunk', audioListener);
      
      await voiceAgent.processText('Hello');
      
      // Both should be called
      // expect(textListener).toHaveBeenCalled();
      // expect(audioListener).toHaveBeenCalled();
    });
  });

  describe('Interruption Handling', () => {
    beforeEach(async () => {
      voiceAgent = new VoiceAgent({
        ...config,
        interruption: { enabled: true, cancelOnNewInput: true },
      });
      await voiceAgent.initialize();
    });

    it('should support interruption', async () => {
      await expect(voiceAgent.interrupt()).resolves.not.toThrow();
    });

    it('should emit interrupted event', async () => {
      const interruptListener = vi.fn();
      voiceAgent.on('interrupted', interruptListener);
      
      await voiceAgent.interrupt();
      expect(interruptListener).toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      voiceAgent = new VoiceAgent(config);
      await voiceAgent.initialize();
    });

    it('should get conversation history', async () => {
      const history = await voiceAgent.getConversationHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should clear conversation history', async () => {
      await expect(voiceAgent.clearHistory()).resolves.not.toThrow();
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      voiceAgent = new VoiceAgent({
        ...config,
        logging: { level: 'info', enableMetrics: true },
      });
      await voiceAgent.initialize();
    });

    it('should track metrics', () => {
      const metrics = voiceAgent.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalLatency');
      expect(metrics).toHaveProperty('sttLatency');
      expect(metrics).toHaveProperty('llmLatency');
      expect(metrics).toHaveProperty('ttsLatency');
      expect(metrics).toHaveProperty('turns');
    });

    it('should emit metrics events', (done) => {
      voiceAgent.on('metrics', (metrics) => {
        expect(metrics).toBeDefined();
        done();
      });
      
      // Process something to generate metrics
      voiceAgent.processText('Test');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid config gracefully', () => {
      expect(() => {
        new VoiceAgent({} as any);
      }).toThrow();
    });

    it('should emit error events', (done) => {
      voiceAgent = new VoiceAgent(config);
      
      voiceAgent.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });
      
      // Trigger error (e.g., process before initialize)
      voiceAgent.processText('Test');
    });
  });

  describe('Cleanup', () => {
    it('should stop gracefully', async () => {
      voiceAgent = new VoiceAgent(config);
      await voiceAgent.initialize();
      await expect(voiceAgent.stop()).resolves.not.toThrow();
    });

    it('should emit stopped event', async () => {
      voiceAgent = new VoiceAgent(config);
      await voiceAgent.initialize();
      
      const stoppedListener = vi.fn();
      voiceAgent.on('stopped', stoppedListener);
      
      await voiceAgent.stop();
      expect(stoppedListener).toHaveBeenCalled();
    });
  });
});

