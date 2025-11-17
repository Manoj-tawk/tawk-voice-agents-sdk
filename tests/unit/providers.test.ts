/**
 * Provider Unit Tests
 * 
 * Tests for STT, TTS, and VAD providers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSTTProvider } from '../../src/providers/stt';
import { createTTSProvider } from '../../src/providers/tts';
import { createVADProvider } from '../../src/providers/vad';

describe('STT Providers', () => {
  describe('createSTTProvider', () => {
    it('should create Deepgram provider', () => {
      const provider = createSTTProvider({
        provider: 'deepgram',
        apiKey: 'test-key',
      } as any);
      
      expect(provider).toBeDefined();
      expect(provider).toHaveProperty('transcribe');
      expect(provider).toHaveProperty('transcribeStream');
      expect(provider).toHaveProperty('stop');
    });

    it('should create OpenAI provider', () => {
      const provider = createSTTProvider({
        provider: 'openai',
        apiKey: 'test-key',
      } as any);
      
      expect(provider).toBeDefined();
    });

    it('should create AssemblyAI provider', () => {
      const provider = createSTTProvider({
        provider: 'assemblyai',
        apiKey: 'test-key',
      } as any);
      
      expect(provider).toBeDefined();
    });

    it('should throw on invalid provider', () => {
      expect(() => {
        createSTTProvider({
          provider: 'invalid' as any,
          apiKey: 'test-key',
        } as any);
      }).toThrow();
    });
  });
});

describe('TTS Providers', () => {
  describe('createTTSProvider', () => {
    it('should create ElevenLabs provider', () => {
      const provider = createTTSProvider({
        provider: 'elevenlabs',
        apiKey: 'test-key',
        voiceId: 'test-voice-id',
      } as any);
      
      expect(provider).toBeDefined();
      expect(provider).toHaveProperty('synthesize');
      expect(provider).toHaveProperty('stop');
    });

    it('should create Cartesia provider', () => {
      const provider = createTTSProvider({
        provider: 'cartesia',
        apiKey: 'test-key',
      } as any);
      
      expect(provider).toBeDefined();
    });

    it('should create OpenAI provider', () => {
      const provider = createTTSProvider({
        provider: 'openai',
        apiKey: 'test-key',
      } as any);
      
      expect(provider).toBeDefined();
    });

    it('should create Deepgram provider', () => {
      const provider = createTTSProvider({
        provider: 'deepgram',
        apiKey: 'test-key',
      } as any);
      
      expect(provider).toBeDefined();
    });

    it('should create Azure provider', () => {
      const provider = createTTSProvider({
        provider: 'azure',
        apiKey: 'test-key',
        config: {
          region: 'test-region',
        },
      } as any);
      
      expect(provider).toBeDefined();
    });

    it('should throw on invalid provider', () => {
      expect(() => {
        createTTSProvider({
          provider: 'invalid' as any,
          apiKey: 'test-key',
        } as any);
      }).toThrow();
    });
  });
});

describe('VAD Providers', () => {
  describe('createVADProvider', () => {
    it('should create energy VAD provider', () => {
      const provider = createVADProvider({
        enabled: true,
        silenceThresholdMs: 700,
      } as any);
      
      expect(provider).toBeDefined();
      expect(provider).toHaveProperty('detect');
      expect(provider).toHaveProperty('start');
      expect(provider).toHaveProperty('stop');
    });

    it('should handle disabled VAD', () => {
      const provider = createVADProvider({
        enabled: false,
      } as any);
      
      expect(provider).toBeDefined();
    });
  });
});

