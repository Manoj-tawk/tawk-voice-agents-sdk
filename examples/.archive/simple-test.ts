/**
 * Simple Test Example - Test Voice Agent SDK
 * 
 * This example demonstrates:
 * 1. Starting a WebSocket server
 * 2. Creating a test client
 * 3. Sending audio/text
 * 4. Receiving responses
 */

import { VoiceAgentServer } from '../server';
import { VoiceAgentClient } from '../client';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration
const SERVER_PORT = 8080;
const API_KEY = 'test-api-key-123';

async function main() {
  console.log('🧪 Voice Agent SDK - Simple Test\n');

  // Step 1: Start Server
  console.log('📡 Starting WebSocket server...');
  const server = new VoiceAgentServer({
    port: SERVER_PORT,
    apiKeys: [API_KEY],
    providers: {
      stt: {
        apiKey: process.env.DEEPGRAM_API_KEY || '',
        defaultModel: 'nova-2',
      },
      llm: {
        apiKey: process.env.OPENAI_API_KEY || '',
        defaultModel: 'gpt-4o-mini',
      },
      tts: {
        apiKey: process.env.ELEVENLABS_API_KEY || '',
        defaultVoice: process.env.ELEVENLABS_VOICE_ID || '',
      },
    },
  });

  server.on('session.created', ({ sessionId, total }) => {
    console.log(`✅ Session created: ${sessionId} (Total: ${total})`);
  });

  server.on('session.destroyed', ({ sessionId, total }) => {
    console.log(`❌ Session destroyed: ${sessionId} (Remaining: ${total})`);
  });

  server.on('error', (error) => {
    console.error('❌ Server error:', error.message);
  });

  console.log(`✅ Server running on ws://localhost:${SERVER_PORT}\n`);

  // Step 2: Create Client
  console.log('🔌 Connecting client...');
  const client = new VoiceAgentClient({
    apiKey: API_KEY,
    url: `ws://localhost:${SERVER_PORT}`,
    stt: 'deepgram',
    llm: 'gpt-4o-mini',
    tts: 'elevenlabs',
    instructions: 'You are a helpful AI assistant. Keep responses brief and friendly.',
    autoPlayAudio: false, // Don't auto-play for testing
  });

  // Setup event listeners
  client.on('connected', () => {
    console.log('✅ Client connected');
  });

  client.on('session.created', (session) => {
    console.log('✅ Session created:', session.id);
  });

  client.on('transcription', (text) => {
    console.log('👤 User:', text);
  });

  client.on('response.text', (text) => {
    console.log('🤖 Assistant:', text);
  });

  client.on('error', (error) => {
    console.error('❌ Client error:', error.message);
  });

  // Step 3: Connect
  try {
    await client.connect();
    console.log('✅ Client connected successfully\n');

    // Wait a bit for session to be created
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 4: Send Test Message
    console.log('📤 Sending test message...');
    console.log('👤 User: Hello, how are you?\n');
    client.sendText('Hello, how are you?');

    // Wait for response
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 5: Send Another Message
    console.log('\n📤 Sending another message...');
    console.log('👤 User: What is 2 + 2?\n');
    client.sendText('What is 2 + 2?');

    // Wait for response
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 6: Cleanup
    console.log('\n🧹 Cleaning up...');
    client.disconnect();
    await server.close();

    console.log('✅ Test completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error: any) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run test
main();

