/**
 * E2E TEST 02: Multi-Agent & Race Patterns
 * 
 * Real API tests for advanced agent patterns:
 * - Multi-agent handoffs
 * - Race agents (parallel execution)
 * - Agent coordination
 */

import 'dotenv/config';
import { Agent, run, raceAgents, setDefaultModel } from '@tawk-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

setDefaultModel(openai('gpt-4o-mini'));

console.log('\n🧪 E2E TEST 02: Multi-Agent & Race Patterns\n');
console.log('⚠️  This test makes REAL API calls!\n');

// ============================================
// TEST 1: Multi-Agent Handoff
// ============================================

async function test1_MultiAgentHandoff() {
  console.log('📍 Test 1: Multi-Agent Handoff');

  // Specialized math agent
  const mathAgent = new Agent({
    name: 'Math Specialist',
    instructions: 'You are a math expert. Solve math problems accurately. Be concise.',
    tools: {
      calculate: {
        description: 'Perform calculations',
        parameters: z.object({
          expression: z.string(),
        }),
        execute: async ({ expression }: any) => {
          const result = eval(expression);
          console.log(`   🔧 Math tool: ${expression} = ${result}`);
          return { result };
        },
      },
    },
  });

  // Coordinator agent
  const coordinator = new Agent({
    name: 'Coordinator',
    instructions: 'You coordinate tasks. For math questions, hand off to the Math Specialist.',
    handoffs: [mathAgent],
  });

  const result = await run(coordinator, 'Calculate 123 * 456 and explain the result');

  console.log('✅ Started with:', coordinator.name);
  console.log('📝 Final response:', result.finalOutput);
  console.log('🔄 Handoff chain:', result.metadata.handoffChain?.join(' → ') || 'None');
  console.log('📊 Tokens:', result.metadata.totalTokens);
  console.log();

  return result;
}

// ============================================
// TEST 2: Race Agents (Parallel Execution)
// ============================================

async function test2_RaceAgents() {
  console.log('📍 Test 2: Race Agents (Parallel Execution)');

  const fastAgent = new Agent({
    name: 'Fast Agent',
    instructions: 'Answer in exactly 3 words or less.',
  });

  const verboseAgent = new Agent({
    name: 'Verbose Agent',
    instructions: 'Provide a detailed, comprehensive explanation with examples.',
  });

  console.log('   🏁 Racing 2 agents...');
  const startTime = Date.now();
  
  const result = await raceAgents(
    [fastAgent, verboseAgent],
    'What is TypeScript?'
  );

  const duration = Date.now() - startTime;

  console.log('✅ Winner:', result.winningAgent.name);
  console.log('⏱️  Time:', duration, 'ms');
  console.log('📝 Response:', result.finalOutput);
  console.log('👥 Participants:', result.metadata.raceParticipants?.join(', '));
  console.log('📊 Tokens:', result.metadata.totalTokens);
  console.log();

  return result;
}

// ============================================
// TEST 3: Race with Fallback Pattern
// ============================================

async function test3_RaceFallback() {
  console.log('📍 Test 3: Race with Fallback Pattern');

  const primaryAgent = new Agent({
    name: 'Primary (Quick)',
    instructions: 'Answer briefly and quickly.',
  });

  const backupAgent = new Agent({
    name: 'Backup (Detailed)',
    instructions: 'Provide thorough explanation.',
  });

  const result = await raceAgents(
    [primaryAgent, backupAgent],
    'Explain async/await in JavaScript'
  );

  console.log('✅ Winner:', result.winningAgent.name);
  console.log('📝 Response:', result.finalOutput.substring(0, 100) + '...');
  console.log('💡 Pattern: Fallback pattern demonstrated');
  console.log();

  return result;
}

// ============================================
// RUN ALL TESTS
// ============================================

async function runAllTests() {
  const startTime = Date.now();

  try {
    await test1_MultiAgentHandoff();
    await test2_RaceAgents();
    await test3_RaceFallback();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL MULTI-AGENT E2E TESTS PASSED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('\n❌ E2E TEST FAILED:', error.message);
    process.exit(1);
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY not found');
  process.exit(1);
}

runAllTests();

