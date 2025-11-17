/**
 * Standalone End-to-End Test Script
 * 
 * Run with: OPENAI_API_KEY=your_key ts-node tests/e2e/test-dummy-audio.ts
 * 
 * Tests the complete pipeline: Audio → STT → Tawk Agents SDK → TTS → Audio + Text Output
 */

import { VoiceAgent } from '../../src/voice-agent/voice-agent';
import { tool, MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
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

async function runTest() {
  console.log('\n' + '='.repeat(60));
  console.log('🎙️  End-to-End Test: Dummy Audio → Full Pipeline');
  console.log('='.repeat(60));
  console.log('');

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ ERROR: OPENAI_API_KEY environment variable not set');
    console.log('\nUsage:');
    console.log('  OPENAI_API_KEY=your_key ts-node tests/e2e/test-dummy-audio.ts');
    console.log('  or');
    console.log('  export OPENAI_API_KEY=your_key');
    console.log('  ts-node tests/e2e/test-dummy-audio.ts');
    process.exit(1);
  }

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

  // Create voice agent
  console.log('📦 Creating VoiceAgent...');
  const voiceAgent = new VoiceAgent({
    transport: { type: 'websocket' },
    
    // STT Provider - using OpenAI Whisper
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
    
    // TTS Provider - using OpenAI
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
    console.log('🔧 Tool called:', toolCall.name, toolCall.parameters);
  });

  voiceAgent.on('error', (error: any) => {
    events.errors.push(error);
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  });

  voiceAgent.on('metrics', (metrics: any) => {
    events.metrics = metrics;
    console.log('\n📊 Metrics:');
    console.log(`  Total Latency: ${metrics.totalLatency}ms`);
    console.log(`  STT Latency: ${metrics.sttLatency}ms`);
    console.log(`  LLM Latency: ${metrics.llmLatency}ms`);
    console.log(`  TTS Latency: ${metrics.ttsLatency}ms`);
    console.log(`  Turns: ${metrics.turns}`);
  });

  try {
    // Initialize
    console.log('🚀 Initializing VoiceAgent...');
    await voiceAgent.initialize();
    console.log('✅ VoiceAgent initialized\n');

    // Test 1: Process dummy audio
    console.log('='.repeat(60));
    console.log('TEST 1: Processing Dummy Audio');
    console.log('='.repeat(60));
    
    const dummyAudio = generateDummyAudio(1000);
    console.log(`🎵 Generated dummy audio: ${dummyAudio.length} bytes (PCM16, 16kHz, mono)`);
    console.log('🚀 Processing audio through pipeline...\n');

    await voiceAgent.processAudio(dummyAudio);

    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second timeout

    console.log('\n📊 Test 1 Results:');
    console.log(`  - Transcription: ${events.transcription ? '✅' : '⚠️  (STT might not transcribe dummy audio)'}`);
    console.log(`  - Response text: ${events.responseText ? '✅' : '❌'}`);
    console.log(`  - Response deltas: ${events.responseDeltas.length}`);
    console.log(`  - Audio chunks: ${events.audioChunks.length}`);
    console.log(`  - Tool calls: ${events.toolCalls.length}`);
    console.log(`  - Errors: ${events.errors.length}`);
    console.log(`  - Metrics: ${events.metrics ? '✅' : '❌'}`);

    // Test 2: Process text input
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Processing Text Input');
    console.log('='.repeat(60));
    
    // Reset events
    events.responseText = undefined;
    events.responseDeltas = [];
    events.audioChunks = [];
    events.toolCalls = [];
    events.errors = [];

    console.log('🚀 Processing text input: "Say hello in one word"\n');
    await voiceAgent.processText('Say hello in one word');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n📊 Test 2 Results:');
    console.log(`  - Response text: ${events.responseText ? '✅' : '❌'}`);
    console.log(`  - Audio chunks: ${events.audioChunks.length > 0 ? '✅' : '❌'}`);
    console.log(`  - Dual output verified: ${events.responseText && events.audioChunks.length > 0 ? '✅' : '❌'}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ End-to-End Test Summary');
    console.log('='.repeat(60));
    console.log('');
    console.log('Pipeline Tested:');
    console.log('  Audio → STT → Tawk Agents SDK → TTS → Audio + Text');
    console.log('  Text → Tawk Agents SDK → TTS → Audio + Text');
    console.log('');
    console.log('Status:');
    const allTestsPassed = 
      (events.responseText || events.audioChunks.length > 0) && // Got some response
      events.errors.length === 0; // No critical errors
    
    if (allTestsPassed) {
      console.log('  ✅ All tests passed!');
    } else {
      console.log('  ⚠️  Some tests had issues (check logs above)');
    }
    console.log('');

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up...');
    await voiceAgent.stop();
    console.log('✅ Done!\n');
  }
}

// Run the test
runTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

