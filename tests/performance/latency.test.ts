/**
 * Performance & Latency Tests
 * 
 * Benchmarks for voice agent performance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VoiceAgent } from '../../src/voice-agent/voice-agent';
import { openai } from '@ai-sdk/openai';

describe('Performance Benchmarks', () => {
  let voiceAgent: VoiceAgent;

  beforeEach(() => {
    voiceAgent = new VoiceAgent({
      transport: { type: 'websocket' },
      stt: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY || 'test',
      },
      agent: {
        model: openai('gpt-4o-mini'),
        instructions: 'Be brief.',
        modelSettings: {
          temperature: 0.5,
          maxTokens: 50,
        },
      },
      tts: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY || 'test',
      },
      logging: {
        level: 'error',
        enableMetrics: true,
      },
    });
  });

  afterEach(async () => {
    if (voiceAgent) {
      await voiceAgent.stop();
    }
  });

  it('should have total latency under 1000ms', async () => {
    await voiceAgent.initialize();

    const startTime = Date.now();

    await voiceAgent.processText('Hello');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const metrics = voiceAgent.getMetrics();
    
    // Target: <1000ms total latency
    expect(metrics.totalLatency).toBeLessThan(1000);
  }, 10000);

  it('should have LLM latency under 500ms', async () => {
    await voiceAgent.initialize();

    await voiceAgent.processText('Hi');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const metrics = voiceAgent.getMetrics();
    
    // Target: <500ms LLM latency
    expect(metrics.llmLatency).toBeLessThan(500);
  }, 10000);

  it('should handle multiple concurrent requests', async () => {
    await voiceAgent.initialize();

    const requests = Array.from({ length: 5 }, (_, i) => 
      voiceAgent.processText(`Request ${i}`)
    );

    const startTime = Date.now();
    await Promise.all(requests);
    const duration = Date.now() - startTime;

    // Should handle 5 requests in reasonable time
    expect(duration).toBeLessThan(10000);
  }, 15000);
});

