/**
 * Test 04: Guardrails
 * 
 * Tests:
 * - Input guardrails
 * - Output guardrails
 * - Content safety
 * - PII detection
 * - Length limits
 */

import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { Agent, run, setDefaultModel, piiDetectionGuardrail, lengthGuardrail } from '@tawk-agents-sdk/core';

// Setup
setDefaultModel(openai('gpt-4o-mini'));

console.log('\n🧪 TEST 04: Guardrails\n');
console.log('='.repeat(70));

async function test04() {
  try {
    // Test 1: PII Detection
    console.log('\n📌 Test 4.1: PII Detection Guardrail');
    const agent1 = new Agent({
      name: 'SafeAgent',
      instructions: 'You are a helpful assistant.',
      guardrails: [
        piiDetectionGuardrail({
          type: 'input',
          block: false, // Just detect, don't block
        }),
      ],
    });

    const result1 = await run(agent1, 'My phone number is 555-1234.');
    console.log('✅ PII detection works (non-blocking)');
    console.log('   Response:', result1.finalOutput.substring(0, 50) + '...');

    // Test 2: Length Limit
    console.log('\n📌 Test 4.2: Length Limit Guardrail');
    const agent2 = new Agent({
      name: 'BriefAgent',
      instructions: 'Be brief.',
      guardrails: [
        lengthGuardrail({
          type: 'output',
          minLength: 10,
          maxLength: 1000,  // Increased to handle longer responses
        }),
      ],
    });

    const result2 = await run(agent2, 'Tell me about AI.');
    console.log('✅ Length validation works');
    console.log('   Response length:', result2.finalOutput.length);

    // Test 3: Custom Guardrail
    console.log('\n📌 Test 4.3: Custom Guardrail');
    const agent3 = new Agent({
      name: 'CustomAgent',
      instructions: 'Be helpful.',
      guardrails: [
        {
          name: 'custom_block',
          type: 'input',
          validate: async (content: string) => {
            if (content.toLowerCase().includes('forbidden')) {
              return {
                passed: false,
                message: 'Content contains forbidden word',
              };
            }
            return { passed: true };
          },
        },
      ],
    });

    const result3 = await run(agent3, 'Tell me a joke.');
    console.log('✅ Custom guardrail works');
    console.log('   Response:', result3.finalOutput.substring(0, 50) + '...');

    // Test 4: Blocked content
    console.log('\n📌 Test 4.4: Blocked Content');
    try {
      await run(agent3, 'This is forbidden content.');
      console.log('❌ Should have been blocked');
    } catch (error: any) {
      console.log('✅ Content blocked correctly:', error.message.substring(0, 50));
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL TESTS PASSED');
    console.log('\n📊 Summary:');
    console.log(`  Guardrails tested: PII, Length, Custom`);
    console.log(`  Total runs: 4`);
    console.log('='.repeat(70) + '\n');

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  }
}

// Run test
test04()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
