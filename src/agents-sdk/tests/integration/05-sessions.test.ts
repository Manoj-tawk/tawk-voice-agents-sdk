/**
 * Test 05: Session Management
 * 
 * Tests:
 * - In-memory sessions
 * - Session history
 * - Context persistence
 * - Multiple sessions
 */

import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { Agent, run, setDefaultModel, SessionManager } from '@tawk-agents-sdk/core';

// Setup
setDefaultModel(openai('gpt-4o-mini'));

console.log('\n🧪 TEST 05: Session Management\n');
console.log('='.repeat(70));

async function test05() {
  try {
    const agent = new Agent({
      name: 'ChatAgent',
      instructions: 'You are a helpful assistant. Remember context from previous messages.',
    });

    // Test 1: In-memory session
    console.log('\n📌 Test 5.1: In-Memory Session');
    const sessionManager = new SessionManager({ type: 'memory' });
    const session = sessionManager.getSession('test-session-1');

    console.log('✅ Session created/retrieved:', session.id);

    const result1 = await run(agent, 'My name is Alice.', { session });
    console.log('✅ Message 1:', result1.finalOutput.substring(0, 50) + '...');

    const result2 = await run(agent, 'What is my name?', { session });
    console.log('✅ Message 2:', result2.finalOutput);
    
    const history = await session.getHistory();
    console.log('✅ Session history length:', history.length);

    // Test 2: Context persistence
    console.log('\n📌 Test 5.2: Context Persistence');
    const result3 = await run(agent, 'Repeat my name in capital letters.', { session });
    console.log('✅ Message 3 (with context):', result3.finalOutput);

    // Test 3: Multiple sessions
    console.log('\n📌 Test 5.3: Multiple Sessions');
    const session1 = sessionManager.getSession('multi-1');
    const session2 = sessionManager.getSession('multi-2');

    await run(agent, 'My name is Bob.', { session: session1 });
    await run(agent, 'My name is Carol.', { session: session2 });

    const bobResult = await run(agent, 'What is my name?', { session: session1 });
    const carolResult = await run(agent, 'What is my name?', { session: session2 });

    console.log('✅ Session 1 (Bob):', bobResult.finalOutput);
    console.log('✅ Session 2 (Carol):', carolResult.finalOutput);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL TESTS PASSED');
    console.log('\n📊 Summary:');
    console.log(`  Sessions tested: 3`);
    console.log(`  Messages: ${(await session.getHistory()).length + (await session1.getHistory()).length + (await session2.getHistory()).length}`);
    console.log('='.repeat(70) + '\n');

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  }
}

// Run test
test05()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
