/**
 * Test 02: Multi-Agent & Handoffs (OpenAI SDK Pattern with withTrace)
 * 
 * Tests:
 * - ONE trace containing multiple agents
 * - Automatic handoffs within single trace
 * - Hierarchical spans (Agent → Generation → Tools)
 * - Aggregated token tracking across all agents
 * - Proper OpenAI SDK multi-agent pattern
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
  withTrace 
} from '@tawk-agents-sdk/core';
import { z } from 'zod';

// Setup
setDefaultModel(openai('gpt-4o-mini'));
const langfuse = initializeLangfuse();

console.log('\n🧪 TEST 02: Multi-Agent & Handoffs (OpenAI SDK Pattern)\n');
console.log('='.repeat(70));

async function test02() {
  try {
    // Create specialized agents
    console.log('\n📌 Creating Specialized Agents...');
    
    const mathAgent = new Agent({
      name: 'MathExpert',
      instructions: 'You are a math expert. When you receive a math problem, use the calculate tool to solve it. Be concise.',
      handoffDescription: 'Specialized in mathematical calculations and problem solving',
      tools: {
        calculate: tool({
          description: 'Perform mathematical calculations',
          parameters: z.object({
            expression: z.string().describe('Mathematical expression to evaluate'),
          }),
          execute: async ({ expression }) => {
            console.log(`  🧮 MathExpert calculating: ${expression}`);
            try {
              const result = eval(expression);
              return { result, expression };
            } catch (e) {
              return { error: 'Invalid expression', expression };
            }
          },
        }),
      },
    });

    const writerAgent = new Agent({
      name: 'WriterExpert',
      instructions: 'You are a professional writer. Create clear, engaging content using the writeContent tool. Be concise.',
      handoffDescription: 'Expert in writing articles, summaries, and creative content',
      tools: {
        writeContent: tool({
          description: 'Write formatted professional content',
          parameters: z.object({
            topic: z.string().describe('The topic to write about'),
            style: z.enum(['formal', 'casual', 'technical']).optional().describe('Writing style'),
          }),
          execute: async ({ topic, style }) => {
            console.log(`  ✍️  WriterExpert creating ${style || 'default'} content about: ${topic}`);
            return {
              content: `Professional ${style || 'default'} content about ${topic}`,
              style: style || 'default',
              wordCount: 50,
            };
          },
        }),
      },
    });

    const coordinator = new Agent({
      name: 'Coordinator',
      instructions: `You coordinate tasks between specialized agents. You have access to:
- MathExpert: Expert in mathematical calculations
- WriterExpert: Expert in writing and content creation

When you receive a task:
- If it involves math/calculations, use handoff_to_mathexpert
- If it involves writing/content, use handoff_to_writerexpert

Always delegate to the appropriate specialist.`,
      handoffs: [mathAgent, writerAgent],
    });

    console.log('✅ Agents created with handoff configuration\n');

    // 🔥 KEY: Wrap EVERYTHING in ONE withTrace()
    await withTrace('Multi-Agent Workflow Test', async (trace) => {
      console.log('📊 ONE TRACE CREATED for entire workflow\n');
      
      // Test 1: Math task - all happens in this trace
      console.log('📌 Test 2.1: Math Task with Internal Handoff');
      
      const result1 = await run(
        coordinator,
        'Calculate 123 * 456 for me.',
        { maxTurns: 15 }
      );

      console.log('\n✅ Math Task Result:');
      console.log(`   Output: ${result1.finalOutput.substring(0, 100)}...`);
      console.log(`   Tokens: ${result1.metadata?.totalTokens || 0}`);
      console.log(`   Tool Calls: ${result1.metadata?.totalToolCalls || 0}`);
      
      if (result1.metadata?.handoffChain && result1.metadata.handoffChain.length > 1) {
        console.log(`   ✅ Handoff Chain: ${result1.metadata.handoffChain.join(' → ')}`);
      }

      // Test 2: Writing task - SAME trace
      console.log('\n📌 Test 2.2: Writing Task with Internal Handoff');
      
      const result2 = await run(
        coordinator,
        'Write a brief description about artificial intelligence.',
        { maxTurns: 15 }
      );

      console.log('\n✅ Writing Task Result:');
      console.log(`   Output: ${result2.finalOutput.substring(0, 100)}...`);
      console.log(`   Tokens: ${result2.metadata?.totalTokens || 0}`);
      
      if (result2.metadata?.handoffChain && result2.metadata.handoffChain.length > 1) {
        console.log(`   ✅ Handoff Chain: ${result2.metadata.handoffChain.join(' → ')}`);
      }

      // Summary
      console.log('\n' + '='.repeat(70));
      console.log('✅ ALL TESTS IN ONE TRACE');
      console.log('\n📊 Aggregated Metrics:');
      const totalTokens = (result1.metadata?.totalTokens || 0) + (result2.metadata?.totalTokens || 0);
      const totalToolCalls = (result1.metadata?.totalToolCalls || 0) + (result2.metadata?.totalToolCalls || 0);
      console.log(`  Total Tokens: ${totalTokens}`);
      console.log(`  Total Tool Calls: ${totalToolCalls}`);
      console.log(`  Trace ID: ${trace.traceId || 'N/A'}`);
      console.log('='.repeat(70));

    }, { metadata: { testName: 'multi-agent' } });

    // Test 3: Sequential multi-agent (separate trace - intentional)
    console.log('\n📌 Test 2.3: Sequential Pattern (Separate Traces)');
    
    const researcher = new Agent({
      name: 'Researcher',
      instructions: 'Research topics and provide facts. Be concise.',
    });
    
    const analyst = new Agent({
      name: 'Analyst',
      instructions: 'Analyze research data. Be concise.',
    });

    const researchResult = await run(researcher, 'What are the benefits of AI?');
    const analysisResult = await run(analyst, `Analyze this research: ${researchResult.finalOutput}`);

    console.log(`   ✅ Research completed`);
    console.log(`   ✅ Analysis completed`);

    // Flush Langfuse
    if (langfuse) {
      console.log('\n⏳ Flushing Langfuse traces...');
      await flushLangfuse();
      console.log('✅ Langfuse traces sent!');
      console.log('\n📊 You should see:');
      console.log('   1. ONE trace "Multi-Agent Workflow Test" with:');
      console.log('      - Coordinator agent spans');
      console.log('      - Nested generation spans');
      console.log('      - Handoff spans (if handoffs occurred)');
      console.log('      - Aggregated tokens');
      console.log('   2. Separate traces for sequential tests');
      console.log('\n   View at: https://us.cloud.langfuse.com\n');
    }

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  }
}

// Run test
test02()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
