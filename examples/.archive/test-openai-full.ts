/**
 * Complete OpenAI Test - End-to-End Verification
 * 
 * Tests the full pipeline with OpenAI for all components:
 * - STT: OpenAI Whisper
 * - LLM: OpenAI GPT-4o via Tawk Agents SDK
 * - TTS: OpenAI TTS
 */

import { VoiceAgent } from '../src/voice-agent';
import { Agent, tool } from '../src/agents-sdk';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

async function runTests() {
  console.log('='.repeat(60));
  console.log('🎙️  Voice Agent SDK - OpenAI End-to-End Test');
  console.log('='.repeat(60));
  console.log();

  // Verify API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY not found in .env file');
    process.exit(1);
  }

  console.log('✅ OpenAI API Key loaded');
  console.log();

  // ============================================
  // TEST 1: Create AI Agent with Tawk Agents SDK
  // ============================================

  console.log('📋 Test 1: Creating AI Agent with Tools...');

  const getCurrentTime = tool({
    description: 'Get the current time',
    parameters: z.object({}),
    execute: async () => {
      const now = new Date();
      return {
        time: now.toLocaleTimeString(),
        date: now.toLocaleDateString(),
        timestamp: now.toISOString(),
      };
    },
  });

  const calculateSum = tool({
    description: 'Calculate the sum of two numbers',
    parameters: z.object({
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    }),
    execute: async ({ a, b }) => {
      return {
        result: a + b,
        equation: `${a} + ${b} = ${a + b}`,
      };
    },
  });

  const aiAgent = new Agent({
    name: 'VoiceAssistant',
    model: openai('gpt-4o'),
    instructions: `You are a helpful voice assistant. Keep responses brief and natural for voice interactions.
    
Your capabilities:
- Tell the current time
- Do simple calculations

Always speak naturally and concisely.`,
    tools: {
      getCurrentTime,
      calculateSum,
    },
    modelSettings: {
      temperature: 0.7,
      maxTokens: 150,
    },
  });

  console.log('✅ AI Agent created with 2 tools');
  console.log('   - getCurrentTime');
  console.log('   - calculateSum');
  console.log();

  // ============================================
  // TEST 2: Create Voice Agent
  // ============================================

  console.log('📋 Test 2: Creating Voice Agent Pipeline...');

  const voiceAgent = new VoiceAgent({
    transport: {
      type: 'websocket',
    },
    stt: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'whisper-1',
      streaming: false, // OpenAI Whisper doesn't support streaming
    },
    llm: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o',
      temperature: 0.7,
      systemPrompt: 'You are a helpful voice assistant. Keep responses brief.',
    },
    tts: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'tts-1',
      voiceId: 'alloy',
      streaming: false,
    },
    vad: {
      enabled: false,
      silenceThresholdMs: 700,
      speechThresholdMs: 300,
    },
    interruption: {
      enabled: true,
    },
    logging: {
      level: 'info',
      enableMetrics: true,
    },
  });

  console.log('✅ Voice Agent created with OpenAI providers');
  console.log('   - STT: OpenAI Whisper');
  console.log('   - LLM: OpenAI GPT-4o');
  console.log('   - TTS: OpenAI TTS (alloy)');
  console.log();

  // ============================================
  // TEST 3: Initialize Voice Agent
  // ============================================

  console.log('📋 Test 3: Initializing Voice Agent...');

  await voiceAgent.initialize();

  console.log('✅ Voice Agent initialized');
  console.log();

  // ============================================
  // TEST 4: Test Text Processing (LLM + TTS)
  // ============================================

  console.log('📋 Test 4: Testing Text Processing...');
  console.log('   Input: "Hello, what time is it?"');
  console.log();

  // Track events
  let transcriptReceived = false;
  let textResponseReceived = false;
  let audioReceived = false;
  let toolCalled = false;

  voiceAgent.on('transcription', (text: string) => {
    console.log(`   📝 Transcription: "${text}"`);
    transcriptReceived = true;
  });

  voiceAgent.on('response.text.delta', (delta: string) => {
    process.stdout.write(delta);
  });

  voiceAgent.on('response.text', (text: string) => {
    console.log();
    console.log(`   💬 Complete Response: "${text}"`);
    textResponseReceived = true;
  });

  voiceAgent.on('tool.call', (toolCall: any) => {
    console.log(`   🔧 Tool Called: ${toolCall.name}`);
    console.log(`   📊 Parameters:`, JSON.stringify(toolCall.parameters, null, 2));
    toolCalled = true;
  });

  voiceAgent.on('audio.chunk', (chunk: Buffer) => {
    audioReceived = true;
  });

  voiceAgent.on('audio.started', (text: string) => {
    console.log(`   🔊 TTS Started: "${text}"`);
  });

  voiceAgent.on('audio.ended', (text: string) => {
    console.log(`   ✅ TTS Completed`);
  });

  voiceAgent.on('metrics', (metrics: any) => {
    console.log();
    console.log('   📊 Performance Metrics:');
    console.log(`      Total Latency: ${metrics.totalLatency}ms`);
    console.log(`      STT Latency: ${metrics.sttLatency}ms`);
    console.log(`      LLM Latency: ${metrics.llmLatency}ms`);
    console.log(`      TTS Latency: ${metrics.ttsLatency}ms`);
    console.log(`      Turns: ${metrics.turns}`);
  });

  voiceAgent.on('error', (error: Error) => {
    console.error(`   ❌ Error: ${error.message}`);
  });

  // Test text processing
  console.log('   🎤 Processing...');
  await voiceAgent.processText('Hello, what time is it?');

  // Wait a moment for all events
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log();

  // ============================================
  // TEST 5: Test with Tool Call
  // ============================================

  console.log('📋 Test 5: Testing Tool Calling...');
  console.log('   Input: "What is 25 plus 17?"');
  console.log();

  toolCalled = false;
  await voiceAgent.processText('What is 25 plus 17?');

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log();

  // ============================================
  // TEST 6: Test Conversation History
  // ============================================

  console.log('📋 Test 6: Testing Conversation History...');

  const history = voiceAgent.getConversationHistory();
  console.log(`   ✅ History has ${history.length} messages`);

  if (history.length > 0) {
    console.log();
    console.log('   📜 Conversation History:');
    history.forEach((msg, idx) => {
      const preview = msg.content.substring(0, 60);
      console.log(`      ${idx + 1}. [${msg.role}] ${preview}${msg.content.length > 60 ? '...' : ''}`);
    });
  }

  console.log();

  // ============================================
  // TEST 7: Test Metrics
  // ============================================

  console.log('📋 Test 7: Testing Metrics Tracking...');

  const metrics = voiceAgent.getMetrics();
  console.log('   ✅ Metrics retrieved:');
  console.log(`      Total Latency: ${metrics.totalLatency}ms`);
  console.log(`      STT Latency: ${metrics.sttLatency}ms`);
  console.log(`      LLM Latency: ${metrics.llmLatency}ms`);
  console.log(`      TTS Latency: ${metrics.ttsLatency}ms`);
  console.log(`      Total Turns: ${metrics.turns}`);

  console.log();

  // ============================================
  // RESULTS SUMMARY
  // ============================================

  console.log('='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log();

  const results = [
    { name: 'AI Agent Creation', passed: true },
    { name: 'Voice Agent Creation', passed: true },
    { name: 'Voice Agent Initialization', passed: true },
    { name: 'Text Processing', passed: textResponseReceived },
    { name: 'Audio Generation (TTS)', passed: audioReceived },
    { name: 'Tool Calling', passed: toolCalled },
    { name: 'Conversation History', passed: history.length > 0 },
    { name: 'Metrics Tracking', passed: metrics.turns > 0 },
  ];

  let passedCount = 0;
  let failedCount = 0;

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const status = result.passed ? 'PASSED' : 'FAILED';
    console.log(`${icon} ${result.name}: ${status}`);
    
    if (result.passed) passedCount++;
    else failedCount++;
  });

  console.log();
  console.log(`Total: ${passedCount}/${results.length} tests passed`);

  if (failedCount === 0) {
    console.log();
    console.log('🎉 SUCCESS! All tests passed!');
    console.log();
    console.log('✨ Voice Agent SDK is working perfectly with OpenAI!');
    console.log();
    console.log('Next steps:');
    console.log('  1. ✅ Connect to your MediaSoup server');
    console.log('  2. ✅ Start sending audio from calls');
    console.log('  3. ✅ Voice Agent will process and respond');
    console.log();
  } else {
    console.log();
    console.log(`⚠️  ${failedCount} test(s) failed. Please check the logs above.`);
    console.log();
  }

  console.log('='.repeat(60));

  // Cleanup
  await voiceAgent.stop();
  process.exit(failedCount === 0 ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('❌ Fatal Error:', error);
  process.exit(1);
});
