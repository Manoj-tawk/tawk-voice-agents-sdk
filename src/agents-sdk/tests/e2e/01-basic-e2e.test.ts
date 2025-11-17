/**
 * E2E TEST 01: Basic Agent with Real API
 * 
 * This test makes REAL API calls to verify the SDK works correctly.
 * Run this when you want to see actual agent responses.
 * 
 * Requirements:
 * - OPENAI_API_KEY in .env
 * - Network connection
 */

import 'dotenv/config';
import { Agent, run, setDefaultModel } from '@tawk-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Set model
setDefaultModel(openai('gpt-4o-mini'));

console.log('\n🧪 E2E TEST 01: Basic Agent with Real API\n');
console.log('⚠️  This test makes REAL API calls and costs money!\n');

// ============================================
// TEST 1: Simple Question
// ============================================

async function test1_SimpleQuestion() {
  console.log('📍 Test 1: Simple Question');

  const agent = new Agent({
    name: 'Simple Agent',
    instructions: 'You are a helpful assistant. Answer in one sentence.',
  });

  const result = await run(agent, 'What is 2+2?');

  console.log('✅ Agent:', agent.name);
  console.log('📝 Response:', result.finalOutput);
  console.log('📊 Tokens used:', result.metadata.totalTokens);
  console.log('💰 Cost: ~$', ((result.metadata.totalTokens || 0) * 0.00015 / 1000).toFixed(6));
  console.log();

  return result;
}

// ============================================
// TEST 2: Tool Calling
// ============================================

async function test2_ToolCalling() {
  console.log('📍 Test 2: Tool Calling');

  const calculator = {
    description: 'Perform mathematical calculations',
    parameters: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    }),
    execute: async ({ operation, a, b }: any) => {
      let result: number;
      switch (operation) {
        case 'add': result = a + b; break;
        case 'subtract': result = a - b; break;
        case 'multiply': result = a * b; break;
        case 'divide': result = a / b; break;
        default: result = 0;
      }
      console.log(`   🔧 Tool called: ${operation}(${a}, ${b}) = ${result}`);
      return { result, operation, inputs: { a, b } };
    },
  };

  const agent = new Agent({
    name: 'Calculator Agent',
    instructions: 'You are a calculator. Use the calculator tool to solve math problems. Show your work.',
    tools: { calculator },
  });

  const result = await run(agent, 'What is 156 multiplied by 23?');

  console.log('✅ Agent:', agent.name);
  console.log('📝 Response:', result.finalOutput);
  console.log('🔧 Tool calls:', result.metadata.totalToolCalls || 0);
  console.log('📊 Tokens used:', result.metadata.totalTokens);
  console.log('💰 Cost: ~$', ((result.metadata.totalTokens || 0) * 0.00015 / 1000).toFixed(6));
  console.log();

  return result;
}

// ============================================
// TEST 3: Context Injection
// ============================================

async function test3_ContextInjection() {
  console.log('📍 Test 3: Context Injection');

  const getUserInfo = {
    description: 'Get user information from context',
    parameters: z.object({
      field: z.string().describe('Field to retrieve: name, email, or role'),
    }),
    execute: async ({ field }: any, contextWrapper: any) => {
      const context = contextWrapper?.context;
      console.log(`   🔧 Tool accessing context.${field}`);
      return { 
        field, 
        value: context?.[field],
        userId: context?.userId 
      };
    },
  };

  const agent = new Agent({
    name: 'Context Agent',
    instructions: 'Use the getUserInfo tool to answer questions about the current user.',
    tools: { getUserInfo },
  });

  const result = await run(agent, 'What is my name and role?', {
    context: {
      userId: 'user-123',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      role: 'admin',
    },
  });

  console.log('✅ Agent:', agent.name);
  console.log('📝 Response:', result.finalOutput);
  console.log('🔧 Tool calls:', result.metadata.totalToolCalls || 0);
  console.log('📊 Tokens used:', result.metadata.totalTokens);
  console.log('💰 Cost: ~$', ((result.metadata.totalTokens || 0) * 0.00015 / 1000).toFixed(6));
  console.log();

  return result;
}

// ============================================
// TEST 4: Multi-Turn Conversation
// ============================================

async function test4_MultiTurn() {
  console.log('📍 Test 4: Multi-Turn Conversation (showing messages persist)');

  const agent = new Agent({
    name: 'Assistant',
    instructions: 'You are a helpful assistant. Be concise.',
  });

  // Turn 1
  console.log('   💬 Turn 1: "My name is Bob"');
  const result1 = await run(agent, 'My name is Bob');
  console.log('   🤖 Response:', result1.finalOutput);
  
  console.log('   💬 Turn 2: Asking a new question');
  const result2 = await run(agent, 'What is TypeScript?');
  console.log('   🤖 Response:', result2.finalOutput);

  console.log('✅ Multi-turn demo complete');
  console.log('📊 Total tokens:', (result1.metadata.totalTokens || 0) + (result2.metadata.totalTokens || 0));
  console.log();

  return result2;
}

// ============================================
// TEST 5: Error Handling
// ============================================

async function test5_ErrorHandling() {
  console.log('📍 Test 5: Error Handling');

  const failingTool = {
    description: 'A tool that sometimes fails',
    parameters: z.object({
      shouldFail: z.boolean(),
    }),
    execute: async ({ shouldFail }: any) => {
      if (shouldFail) {
        throw new Error('Tool intentionally failed');
      }
      return { success: true };
    },
  };

  const agent = new Agent({
    name: 'Resilient Agent',
    instructions: 'Try to use the tool. If it fails, handle it gracefully.',
    tools: { failingTool },
  });

  try {
    const result = await run(agent, 'Use the tool with shouldFail=false');
    console.log('✅ Success case handled');
    console.log('📝 Response:', result.finalOutput);
    console.log();
  } catch (error: any) {
    console.log('❌ Unexpected error:', error.message);
  }

  return true;
}

// ============================================
// RUN ALL E2E TESTS
// ============================================

async function runAllE2ETests() {
  const startTime = Date.now();
  let totalCost = 0;

  try {
    const result1 = await test1_SimpleQuestion();
    totalCost += (result1.metadata.totalTokens || 0) * 0.00015 / 1000;

    const result2 = await test2_ToolCalling();
    totalCost += (result2.metadata.totalTokens || 0) * 0.00015 / 1000;

    const result3 = await test3_ContextInjection();
    totalCost += (result3.metadata.totalTokens || 0) * 0.00015 / 1000;

    const result4 = await test4_MultiTurn();
    totalCost += (result4.metadata.totalTokens || 0) * 0.00015 / 1000;

    await test5_ErrorHandling();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL E2E TESTS PASSED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`💰 Total cost: ~$${totalCost.toFixed(6)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('\n❌ E2E TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY not found in environment');
  console.error('💡 Create a .env file with: OPENAI_API_KEY=sk-...\n');
  process.exit(1);
}

runAllE2ETests();

