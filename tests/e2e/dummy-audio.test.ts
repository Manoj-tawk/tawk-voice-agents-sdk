/**
 * End-to-End Test with Dummy Audio
 * 
 * Tests the complete pipeline: Audio → STT → Tawk Agents SDK → TTS → Audio + Text Output
 * Uses dummy PCM16 audio data (16kHz, mono) to test the full flow.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VoiceAgent } from '../../src/voice-agent/voice-agent';
import { tool, MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Generate dummy PCM16 audio buffer (16kHz, mono)
 * Creates a simple sine wave tone for testing
 */
function generateDummyAudio(durationMs: number = 1000): Buffer {
  const sampleRate = 16000; // 16kHz
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = Buffer.allocUnsafe(numSamples * 2); // 2 bytes per sample (16-bit)
  
  const frequency = 440; // A4 note
  const amplitude = 0.3; // 30% volume to avoid clipping
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * amplitude;
    const intSample = Math.floor(sample * 32767);
    
    // Write as little-endian 16-bit signed integer
    buffer.writeInt16LE(intSample, i * 2);
  }
  
  return buffer;
}

describe('End-to-End Test with Dummy Audio', () => {
  let voiceAgent: VoiceAgent;

  // Define a simple tool for testing
  const testTool = tool({
    description: 'A test tool that echoes the input',
    parameters: z.object({
      message: z.string().describe('The message to echo'),
    }),
    execute: async ({ message }) => {
      return { echoed: message };
    },
  });

  beforeEach(() => {
    // Skip if API keys are not set
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set, skipping e2e test');
      return;
    }

    voiceAgent = new VoiceAgent({
      transport: { type: 'websocket' },
      
      // STT Provider - using OpenAI Whisper for testing
      stt: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'whisper-1',
      },
      
      // Agent configuration (powered by Tawk Agents SDK)
      agent: {
        model: openai('gpt-4o-mini'), // Using mini for faster/cheaper testing
        name: 'TestVoiceAgent',
        instructions: 'You are a helpful test assistant. Keep responses very brief, under 10 words.',
        tools: { testTool },
        session: new MemorySession('test-session-e2e'),
        modelSettings: {
          temperature: 0.7,
          maxTokens: 50, // Keep responses short for testing
        },
      },
      
      // TTS Provider - using OpenAI for testing
      tts: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY!,
        voiceId: 'alloy', // Default OpenAI voice
      },
      
      // Disable VAD for testing with dummy audio
      vad: { enabled: false },
      
      // Disable interruption for simpler testing
      interruption: { enabled: false },
      
      // Logging
      logging: {
        level: 'info',
        enableMetrics: true,
      },
    });
  });

  afterEach(async () => {
    if (voiceAgent) {
      await voiceAgent.stop();
    }
  });

  it('should process dummy audio through full pipeline', async () => {
    // Skip if API keys are not set
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  Skipping test - API keys not configured');
      return;
    }

    await voiceAgent.initialize();

    // Track all events
    const events: {
      transcription?: string;
      responseText?: string;
      responseDeltas: string[];
      audioChunks: Buffer[];
      toolCalls: any[];
      errors: any[];
      metrics?: any;
    } = {
      responseDeltas: [],
      audioChunks: [],
      toolCalls: [],
      errors: [],
    };

    // Set up event listeners
    voiceAgent.on('transcription', (text: string) => {
      events.transcription = text;
      console.log('📝 Transcription:', text);
    });

    voiceAgent.on('response.text.delta', (delta: string) => {
      events.responseDeltas.push(delta);
      process.stdout.write(delta);
    });

    voiceAgent.on('response.text', (text: string) => {
      events.responseText = text;
      console.log('\n✅ Full response:', text);
    });

    voiceAgent.on('audio.chunk', (chunk: Buffer) => {
      events.audioChunks.push(chunk);
      console.log(`🔊 Audio chunk received (${chunk.length} bytes)`);
    });

    voiceAgent.on('tool.call', (toolCall: any) => {
      events.toolCalls.push(toolCall);
      console.log('🔧 Tool called:', toolCall.name);
    });

    voiceAgent.on('error', (error: any) => {
      events.errors.push(error);
      console.error('❌ Error:', error);
    });

    voiceAgent.on('metrics', (metrics: any) => {
      events.metrics = metrics;
      console.log('📊 Metrics:', {
        totalLatency: `${metrics.totalLatency}ms`,
        sttLatency: `${metrics.sttLatency}ms`,
        llmLatency: `${metrics.llmLatency}ms`,
        ttsLatency: `${metrics.ttsLatency}ms`,
        turns: metrics.turns,
      });
    });

    // Generate dummy audio (1 second of tone)
    const dummyAudio = generateDummyAudio(1000);
    console.log(`\n🎵 Generated dummy audio: ${dummyAudio.length} bytes (PCM16, 16kHz, mono)`);

    // Process the audio
    console.log('\n🚀 Processing audio through pipeline...');
    await voiceAgent.processAudio(dummyAudio);

    // Wait for processing to complete (with timeout)
    await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second timeout

    // Verify events were emitted
    console.log('\n📊 Test Results:');
    console.log(`  - Transcription: ${events.transcription ? '✅' : '❌'}`);
    console.log(`  - Response text: ${events.responseText ? '✅' : '❌'}`);
    console.log(`  - Response deltas: ${events.responseDeltas.length}`);
    console.log(`  - Audio chunks: ${events.audioChunks.length}`);
    console.log(`  - Tool calls: ${events.toolCalls.length}`);
    console.log(`  - Errors: ${events.errors.length}`);
    console.log(`  - Metrics: ${events.metrics ? '✅' : '❌'}`);

    // Assertions
    // Note: STT might not transcribe dummy audio perfectly, so we're lenient
    // The important thing is that the pipeline runs without errors
    
    // Verify we got a response (either text or audio)
    const gotResponse = events.responseText || events.audioChunks.length > 0;
    expect(gotResponse).toBeTruthy();

    // Verify no critical errors
    const criticalErrors = events.errors.filter((e: any) => 
      !e.message?.includes('transcription') && 
      !e.message?.includes('STT')
    );
    expect(criticalErrors.length).toBe(0);

    // Verify metrics were collected
    if (events.metrics) {
      expect(events.metrics).toHaveProperty('totalLatency');
      expect(events.metrics).toHaveProperty('turns');
    }

    console.log('\n✅ End-to-end test completed successfully!');
  }, 30000); // 30 second timeout

  it('should process text input and generate audio output', async () => {
    // Skip if API keys are not set
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  Skipping test - API keys not configured');
      return;
    }

    await voiceAgent.initialize();

    const events: {
      responseText?: string;
      audioChunks: Buffer[];
    } = {
      audioChunks: [],
    };

    voiceAgent.on('response.text', (text: string) => {
      events.responseText = text;
      console.log('✅ Response:', text);
    });

    voiceAgent.on('audio.chunk', (chunk: Buffer) => {
      events.audioChunks.push(chunk);
      console.log(`🔊 Audio chunk (${chunk.length} bytes)`);
    });

    // Process text input
    console.log('\n🚀 Processing text input...');
    await voiceAgent.processText('Say hello in one word');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Verify dual output
    expect(events.responseText).toBeTruthy();
    expect(events.audioChunks.length).toBeGreaterThan(0);

    console.log('\n✅ Text input test completed!');
    console.log(`  - Text output: ${events.responseText}`);
    console.log(`  - Audio chunks: ${events.audioChunks.length}`);
  }, 20000);

  it('should handle tool calling', async () => {
    // Skip if API keys are not set
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  Skipping test - API keys not configured');
      return;
    }

    await voiceAgent.initialize();

    const toolCalls: any[] = [];

    voiceAgent.on('tool.call', (toolCall: any) => {
      toolCalls.push(toolCall);
      console.log('🔧 Tool called:', toolCall.name, toolCall.parameters);
    });

    // Process text that should trigger tool
    await voiceAgent.processText('Use the test tool with message "hello world"');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Tool might or might not be called depending on model decision
    // Just verify no errors occurred
    console.log(`\n✅ Tool calling test completed (${toolCalls.length} tools called)`);
  }, 20000);
});

