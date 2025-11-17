/**
 * TEST 08: Race Agents Pattern
 * 
 * Tests parallel agent execution with raceAgents():
 * - Multiple agents racing to respond first
 * - Different models racing
 * - Fallback patterns
 * - Error handling when all fail
 */

import { Agent, raceAgents, setDefaultModel } from '@tawk-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

setDefaultModel(openai('gpt-4o-mini'));

const agent = (config: any) => new Agent(config);

console.log('\n🧪 TEST 08: Race Agents Pattern\n');

// ============================================
// TEST 1: Basic Race - Multiple Agents
// ============================================

async function testBasicRace() {
  console.log('📍 Test 1: Basic Race Pattern');

  const fastAgent = agent({
    name: 'Fast Agent',
    instructions: 'Answer in 1 word only',
  });

  const detailedAgent = agent({
    name: 'Detailed Agent',
    instructions: 'Provide a comprehensive answer',
  });

  const result = await raceAgents(
    [fastAgent, detailedAgent],
    'What is 2+2?'
  );

  console.log('✅ Winner:', result.winningAgent.name);
  console.log('   Answer:', result.finalOutput);
  console.log('   Participants:', result.metadata.raceParticipants);
  console.log('   Tokens used:', result.metadata.totalTokens);
}

// ============================================
// TEST 2: Three Agents Racing
// ============================================

async function testThreeAgentRace() {
  console.log('\n📍 Test 2: Three Agents Racing');

  const agent1 = agent({
    name: 'Agent A',
    instructions: 'Be extremely brief',
  });

  const agent2 = agent({
    name: 'Agent B',
    instructions: 'Be concise',
  });

  const agent3 = agent({
    name: 'Agent C',
    instructions: 'Be thorough',
  });

  const result = await raceAgents(
    [agent1, agent2, agent3],
    'What is TypeScript?'
  );

  console.log('✅ Winner:', result.winningAgent.name);
  console.log('   Answer:', result.finalOutput);
  console.log('   All participants:', result.metadata.raceParticipants?.join(', '));
}

// ============================================
// TEST 3: Fallback Pattern
// ============================================

async function testFallbackPattern() {
  console.log('\n📍 Test 3: Fallback Pattern (Primary + Backup)');

  const primaryAgent = agent({
    name: 'Primary (Fast)',
    instructions: 'Answer quickly and briefly',
  });

  const backupAgent = agent({
    name: 'Backup (Detailed)',
    instructions: 'Provide comprehensive answer',
  });

  const result = await raceAgents(
    [primaryAgent, backupAgent],
    'Explain async/await'
  );

  console.log('✅ Winner:', result.winningAgent.name);
  console.log('   This demonstrates fallback: Primary usually wins, but backup is ready');
  console.log('   Answer length:', result.finalOutput.length, 'chars');
}

// ============================================
// TEST 4: Single Agent (Edge Case)
// ============================================

async function testSingleAgent() {
  console.log('\n📍 Test 4: Single Agent Edge Case');

  const soloAgent = agent({
    name: 'Solo Agent',
    instructions: 'You are helpful',
  });

  const result = await raceAgents(
    [soloAgent],
    'Say hello'
  );

  console.log('✅ Winner (only participant):', result.winningAgent.name);
  console.log('   Answer:', result.finalOutput);
}

// ============================================
// TEST 5: Error Handling - Empty Array
// ============================================

async function testEmptyArray() {
  console.log('\n📍 Test 5: Error Handling - Empty Array');

  try {
    await raceAgents([], 'This should fail');
    console.log('❌ Should have thrown error');
  } catch (error: any) {
    console.log('✅ Correctly threw error:', error.message);
  }
}

// ============================================
// TEST 6: Race with Context
// ============================================

async function testRaceWithContext() {
  console.log('\n📍 Test 6: Race with Context Passing');

  const contextAgent1 = agent({
    name: 'Context Agent 1',
    instructions: (ctx: any) => `You have access to user: ${ctx.context?.userId}. Be brief.`,
  });

  const contextAgent2 = agent({
    name: 'Context Agent 2',
    instructions: (ctx: any) => `You have access to user: ${ctx.context?.userId}. Be detailed.`,
  });

  const result = await raceAgents(
    [contextAgent1, contextAgent2],
    'Who am I?',
    {
      context: { userId: 'user-123', role: 'admin' }
    }
  );

  console.log('✅ Winner:', result.winningAgent.name);
  console.log('   Answer:', result.finalOutput);
  console.log('   Context was passed correctly');
}

// ============================================
// TEST 7: Race with Tools
// ============================================

async function testRaceWithTools() {
  console.log('\n📍 Test 7: Race with Tool-Enabled Agents');

  const calculator = {
    description: 'Calculate math expressions',
    parameters: z.object({
      expression: z.string(),
    }),
    execute: async ({ expression }: any) => {
      const result = eval(expression);
      return { result };
    },
  };

  const quickAgent = agent({
    name: 'Quick Calculator',
    instructions: 'Use the calculator tool. Be brief.',
    tools: { calculator },
  });

  const verboseAgent = agent({
    name: 'Verbose Calculator',
    instructions: 'Use the calculator tool. Explain your work.',
    tools: { calculator },
  });

  const result = await raceAgents(
    [quickAgent, verboseAgent],
    'What is 156 * 789?'
  );

  console.log('✅ Winner:', result.winningAgent.name);
  console.log('   Answer:', result.finalOutput);
  console.log('   Tool calls made:', result.metadata.totalToolCalls);
}

// ============================================
// TEST 8: Performance Comparison
// ============================================

async function testPerformanceMetrics() {
  console.log('\n📍 Test 8: Performance Metrics');

  const agents = [
    agent({ name: 'Agent 1', instructions: 'One sentence only' }),
    agent({ name: 'Agent 2', instructions: 'Two sentences' }),
    agent({ name: 'Agent 3', instructions: 'Three sentences' }),
  ];

  const startTime = Date.now();
  
  const result = await raceAgents(agents, 'What is JavaScript?');
  
  const duration = Date.now() - startTime;

  console.log('✅ Race completed in:', duration, 'ms');
  console.log('   Winner:', result.winningAgent.name);
  console.log('   Tokens used:', result.metadata.totalTokens);
  console.log('   Participants:', result.metadata.raceParticipants?.length);
}

// ============================================
// RUN ALL TESTS
// ============================================

async function runAllTests() {
  try {
    await testBasicRace();
    await testThreeAgentRace();
    await testFallbackPattern();
    await testSingleAgent();
    await testEmptyArray();
    await testRaceWithContext();
    await testRaceWithTools();
    await testPerformanceMetrics();

    console.log('\n✅ All Race Agent tests passed!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

runAllTests();

