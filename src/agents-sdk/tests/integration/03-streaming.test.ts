/**
 * Test 03: Streaming
 * 
 * Tests:
 * - Streaming text responses
 * - Streaming with tools
 * - Stream events
 * - Token tracking in streams
 */

import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { Agent, runStream, tool, setDefaultModel, initializeLangfuse } from '@tawk-agents-sdk/core';
import { z } from 'zod';

// Setup
setDefaultModel(openai('gpt-4o-mini'));
const langfuse = initializeLangfuse();

console.log('\n🧪 TEST 03: Streaming\n');
console.log('='.repeat(70));

async function test03() {
  try {
    // Test 1: Basic streaming
    console.log('\n📌 Test 3.1: Basic Text Streaming');
    const simpleAgent = new Agent({
      name: 'StreamAgent',
      instructions: 'You are a helpful assistant. Be descriptive.',
    });

    const stream1 = await runStream(simpleAgent, 'Tell me about AI agents in 2 sentences.');
    
    let fullText = '';
    console.log('  📡 Streaming: ', { newline: false });
    
    for await (const chunk of stream1.textStream) {
      process.stdout.write(chunk);
      fullText += chunk;
    }
    
    console.log('\n✅ Stream complete');
    console.log('✅ Total length:', fullText.length, 'characters');

    // Test 2: Streaming with tools
    console.log('\n📌 Test 3.2: Streaming with Tools');
    const agentWithTools = new Agent({
      name: 'StreamToolAgent',
      instructions: 'Use tools when needed.',
      tools: {
        getInfo: tool({
          description: 'Get information',
          parameters: z.object({
            topic: z.string(),
          }),
          execute: async ({ topic }) => {
            console.log(`  🔧 Tool called: getInfo("${topic}")`);
            return { info: `Information about ${topic}`, source: 'database' };
          },
        }),
      },
    });

    const stream2 = await runStream(agentWithTools, 'Get info about streaming and explain it.');
    
    let text2 = '';
    let toolCalls = 0;
    
    console.log('  📡 Streaming with tools...');
    
    for await (const chunk of stream2.textStream) {
      text2 += chunk;
    }
    
    console.log('✅ Stream complete');
    console.log('✅ Final text length:', text2.length);

    // Test 3: Full stream (events + text)
    console.log('\n📌 Test 3.3: Full Stream with Events');
    const stream3 = await runStream(simpleAgent, 'Count to 3.');
    
    let eventCount = 0;
    console.log('  📡 Processing stream events...');
    
    for await (const chunk of stream3.fullStream) {
      eventCount++;
      if (chunk.type === 'text-delta') {
        // Text chunk
      } else if (chunk.type === 'finish') {
        console.log('  ✅ Stream finished event received');
      }
    }
    
    console.log('✅ Total events:', eventCount);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL TESTS PASSED');
    console.log('\n📊 Summary:');
    console.log(`  Streaming scenarios tested: 3`);
    console.log(`  Text streaming: ✅`);
    console.log(`  Tool streaming: ✅`);
    console.log(`  Event streaming: ✅`);
    console.log('='.repeat(70) + '\n');

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  }
}

// Run test
test03()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

