/**
 * Test Providers - Test individual STT/LLM/TTS providers
 */

import { createSTTProvider } from '../shared/providers/stt';
import { createLLMProvider } from '../shared/providers/llm';
import { createTTSProvider } from '../shared/providers/tts';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

async function testSTT() {
  console.log('\n🎤 Testing STT Provider (Deepgram)...');

  const stt = createSTTProvider({
    provider: 'deepgram',
    apiKey: process.env.DEEPGRAM_API_KEY || '',
    model: 'nova-2',
  });

  // Create a simple test audio buffer (silence)
  const testAudio = Buffer.alloc(16000 * 2); // 1 second of silence at 16kHz

  try {
    const transcript = await stt.transcribe(testAudio);
    console.log('✅ STT Result:', transcript || '(no speech detected)');
  } catch (error: any) {
    console.error('❌ STT Error:', error.message);
  }
}

async function testLLM() {
  console.log('\n🧠 Testing LLM Provider (OpenAI)...');

  const llm = createLLMProvider({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 50,
  });

  try {
    const response = await llm.generate({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello in one sentence.' },
      ],
      stream: false,
    });

    console.log('✅ LLM Result:', response);
  } catch (error: any) {
    console.error('❌ LLM Error:', error.message);
  }
}

async function testTTS() {
  console.log('\n🔊 Testing TTS Provider (ElevenLabs)...');

  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) {
    console.log('⚠️  Skipping TTS test - ElevenLabs API key or voice ID not configured');
    return;
  }

  const tts = createTTSProvider({
    provider: 'elevenlabs',
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
  });

  try {
    const audioChunks: Buffer[] = [];
    const audioStream = tts.synthesize('Hello, this is a test.');

    for await (const chunk of audioStream) {
      audioChunks.push(chunk);
    }

    const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    console.log(`✅ TTS Result: Generated ${totalSize} bytes of audio`);

    // Optionally save to file
    // fs.writeFileSync('test-output.mp3', Buffer.concat(audioChunks));
  } catch (error: any) {
    console.error('❌ TTS Error:', error.message);
  }
}

async function testLLMStreaming() {
  console.log('\n🧠 Testing LLM Streaming (OpenAI)...');

  const llm = createLLMProvider({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini',
  });

  try {
    const responseStream = await llm.generate({
      messages: [{ role: 'user', content: 'Count from 1 to 5.' }],
      stream: true,
    });

    console.log('✅ Streaming response:');
    process.stdout.write('   ');

    for await (const chunk of responseStream as any) {
      if (chunk.type === 'text' && chunk.content) {
        process.stdout.write(chunk.content);
      }
    }
    console.log('\n');
  } catch (error: any) {
    console.error('❌ LLM Streaming Error:', error.message);
  }
}

async function main() {
  console.log('🧪 Testing Voice Agent SDK Providers\n');
  console.log('═══════════════════════════════════════\n');

  // Check environment variables
  const requiredEnvVars = {
    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  };

  console.log('📋 Environment Variables:');
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    console.log(`   ${key}: ${value ? '✅ Set' : '❌ Not set'}`);
  }

  // Run tests
  await testSTT();
  await testLLM();
  await testLLMStreaming();
  await testTTS();

  console.log('\n═══════════════════════════════════════');
  console.log('✅ Provider tests completed!\n');
}

// Run tests
main().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

