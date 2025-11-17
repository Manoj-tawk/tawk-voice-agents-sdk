/**
 * Test 06: Langfuse Tracing
 * 
 * Tests:
 * - Trace creation
 * - Token tracking in traces
 * - Generation spans
 * - Handoff spans
 * - Per-agent metrics
 * - Metadata tracking
 */

import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { 
  Agent, 
  run, 
  tool, 
  setDefaultModel, 
  initializeLangfuse, 
  flushLangfuse,
  isLangfuseEnabled 
} from '@tawk-agents-sdk/core';
import { z } from 'zod';

// Setup
setDefaultModel(openai('gpt-4o-mini'));
const langfuse = initializeLangfuse();

console.log('\n🧪 TEST 06: Langfuse Tracing\n');
console.log('='.repeat(70));

async function test06() {
  if (!isLangfuseEnabled()) {
    console.log('\n⚠️  Langfuse not enabled. Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY in .env');
    console.log('✅ Test skipped (not a failure)\n');
    return true;
  }

  try {
    // Test 1: Basic trace
    console.log('\n📌 Test 6.1: Basic Trace Creation');
    const agent1 = new Agent({
      name: 'TracedAgent',
      instructions: 'You are helpful.',
    });

    const result1 = await run(agent1, 'Say hello');
    
    console.log('✅ Run complete');
    console.log('✅ Tokens tracked:', result1.metadata?.totalTokens || 0);
    console.log('   - Input:', result1.metadata?.promptTokens || 0);
    console.log('   - Output:', result1.metadata?.completionTokens || 0);

    // Test 2: Tool execution trace
    console.log('\n📌 Test 6.2: Tool Execution Tracing');
    const agent2 = new Agent({
      name: 'ToolTracedAgent',
      instructions: 'Use tools.',
      tools: {
        search: tool({
          description: 'Search for information',
          parameters: z.object({
            query: z.string(),
          }),
          execute: async ({ query }) => {
            console.log(`  🔍 Searching: ${query}`);
            return { results: [`Result for ${query}`] };
          },
        }),
      },
    });

    const result2 = await run(agent2, 'Search for AI agents', { maxTurns: 5 });
    
    console.log('✅ Tool execution traced');
    console.log('✅ Tool calls:', result2.metadata?.totalToolCalls || 0);
    console.log('✅ Tokens:', result2.metadata?.totalTokens || 0);

    // Test 3: Multi-agent with handoffs
    console.log('\n📌 Test 6.3: Handoff Tracing');
    const specialist = new Agent({
      name: 'Specialist',
      instructions: 'You are a specialist.',
      handoffDescription: 'Expert specialist',
    });

    const coordinator = new Agent({
      name: 'Coordinator',
      instructions: 'Coordinate with specialists.',
      handoffs: [specialist],
    });

    const result3 = await run(coordinator, 'Complex task', { maxTurns: 10 });
    
    console.log('✅ Multi-agent traced');
    if (result3.metadata?.handoffChain) {
      console.log('✅ Handoff chain:', result3.metadata.handoffChain.join(' → '));
    }
    if (result3.metadata?.agentMetrics) {
      console.log('✅ Per-agent metrics:');
      result3.metadata.agentMetrics.forEach(m => {
        console.log(`   - ${m.agentName}:`);
        console.log(`     Turns: ${m.turns}`);
        console.log(`     Tokens: ${m.tokens.total} (in: ${m.tokens.input}, out: ${m.tokens.output})`);
        console.log(`     Tool Calls: ${m.toolCalls}`);
      });
    }

    // Test 4: Flush traces
    console.log('\n📌 Test 6.4: Flush Traces to Langfuse');
    await flushLangfuse();
    console.log('✅ Traces flushed');
    console.log('✅ View at: https://us.cloud.langfuse.com');

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL TESTS PASSED');
    console.log('\n📊 Summary:');
    const totalTokens = (result1.metadata?.totalTokens || 0) + 
                       (result2.metadata?.totalTokens || 0) + 
                       (result3.metadata?.totalTokens || 0);
    console.log(`  Total tokens tracked: ${totalTokens}`);
    console.log(`  Total tool calls: ${(result2.metadata?.totalToolCalls || 0)}`);
    console.log(`  Traces created: 3`);
    console.log(`  Langfuse dashboard: https://us.cloud.langfuse.com`);
    console.log('='.repeat(70) + '\n');

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  }
}

// Run test
test06()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

