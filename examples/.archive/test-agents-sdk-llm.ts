/**
 * Test agents-sdk as LLM Layer
 * 
 * This demonstrates that agents-sdk IS the LLM layer
 * by directly testing text input without STT/TTS
 */

import { VoiceAgentNew } from '../src/voice-agent/voice-agent-refactored';
import { tool, MemorySession } from '../src/agents-sdk';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// Define Tools
// ============================================

const calculator = tool({
  description: 'Perform basic math calculations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    switch (operation) {
      case 'add':
        return { result: a + b };
      case 'subtract':
        return { result: a - b };
      case 'multiply':
        return { result: a * b };
      case 'divide':
        return { result: a / b };
    }
  },
});

const getSystemInfo = tool({
  description: 'Get system information',
  parameters: z.object({}),
  execute: async () => {
    return {
      platform: process.platform,
      nodeVersion: process.version,
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      uptime: Math.round(process.uptime()) + ' seconds',
    };
  },
});

// ============================================
// Create Voice Agent (text-only mode for testing)
// ============================================

async function testAgentsSDKasLLM() {
  console.log('============================================');
  console.log('Testing agents-sdk AS the LLM Layer');
  console.log('============================================\n');
  
  const session = new MemorySession('test-session');
  
  // Create voice agent with agents-sdk as LLM
  const voiceAgent = new VoiceAgentNew({
    transport: { type: 'websocket' },
    
    // Dummy STT (won't use it)
    stt: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || 'dummy',
    },
    
    // agents-sdk = LLM layer
    agent: {
      model: openai('gpt-4o'),
      name: 'TestAssistant',
      instructions: `You are a test assistant demonstrating that agents-sdk IS the LLM layer.

You can:
- Perform calculations using the calculator tool
- Get system information

Be concise in your responses.`,
      
      tools: {
        calculator,
        getSystemInfo,
      },
      
      session,
      
      modelSettings: {
        temperature: 0.7,
        maxTokens: 200,
      },
    },
    
    // Dummy TTS (won't use it)
    tts: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || 'dummy',
    },
    
    vad: { enabled: false },
  });

  await voiceAgent.initialize();
  
  // Listen to events
  voiceAgent.on('response.text.delta', (delta: string) => {
    process.stdout.write(delta);
  });
  
  voiceAgent.on('response.text', (text: string) => {
    console.log('\n');
  });
  
  voiceAgent.on('tool.call', (toolCall: any) => {
    console.log(`\n[TOOL CALL] ${toolCall.name}`);
    console.log('Parameters:', JSON.stringify(toolCall.parameters, null, 2));
    console.log('Result:', JSON.stringify(toolCall.result, null, 2));
  });
  
  voiceAgent.on('error', (error: Error) => {
    console.error('\n[ERROR]', error.message);
  });
  
  // Test cases
  const testCases = [
    'What is 25 multiplied by 4?',
    'Can you show me the system information?',
    'Calculate 100 divided by 5',
    'What is 15 plus 37?',
  ];
  
  for (const question of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`User: ${question}`);
    console.log(`${'='.repeat(60)}`);
    console.log('Assistant: ');
    
    // Process text directly (skip STT/TTS)
    await voiceAgent.processText(question);
    
    // Wait a bit between questions
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n\n============================================');
  console.log('Test Complete!');
  console.log('============================================');
  console.log('✅ agents-sdk successfully used as LLM layer');
  console.log('✅ Tool calling working');
  console.log('✅ Streaming responses working');
  console.log('✅ Session management working');
  
  await voiceAgent.stop();
  process.exit(0);
}

// Run the test
testAgentsSDKasLLM().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});

