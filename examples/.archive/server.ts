import { VoiceAgentServer } from '../server/index';
import { config } from 'dotenv';

config();

/**
 * Voice Agent WebSocket Server Example
 * 
 * Run this server to handle WebSocket connections from voice agent clients
 */

async function main() {
  console.log('🚀 Starting Voice Agent WebSocket Server...\n');

  // Create server
  const server = new VoiceAgentServer({
    port: 8080,
    
    // API keys for authentication
    apiKeys: [
      'demo-api-key',
      process.env.VOICE_AGENT_API_KEY || 'your-api-key-here'
    ],

    // Session timeout (1 hour)
    sessionTimeout: 3600000,

    // Send welcome message on connect
    sendWelcome: true,

    // Provider API keys
    providers: {
      stt: {
        apiKey: process.env.DEEPGRAM_API_KEY!,
        defaultModel: 'nova-2'
      },
      llm: {
        apiKey: process.env.OPENAI_API_KEY!,
        defaultModel: 'gpt-4o-mini'
      },
      tts: {
        apiKey: process.env.ELEVENLABS_API_KEY!,
        defaultVoice: 'alloy'
      }
    },

    // Optional: MediaSoup integration
    mediasoup: process.env.MEDIASOUP_SERVER_URL ? {
      serverUrl: process.env.MEDIASOUP_SERVER_URL,
      roomId: process.env.MEDIASOUP_ROOM_ID || 'default-room'
    } : undefined
  });

  // Server event handlers
  server.on('session.created', ({ sessionId, total }) => {
    console.log(`✅ New session: ${sessionId}`);
    console.log(`📊 Active sessions: ${total}\n`);
  });

  server.on('session.destroyed', ({ sessionId, total }) => {
    console.log(`❌ Session ended: ${sessionId}`);
    console.log(`📊 Active sessions: ${total}\n`);
  });

  server.on('session.error', ({ sessionId, error }) => {
    console.error(`⚠️  Session ${sessionId} error:`, error.message);
  });

  server.on('error', (error) => {
    console.error('❌ Server error:', error);
  });

  // Periodic stats
  setInterval(() => {
    const sessionCount = server.getSessionCount();
    if (sessionCount > 0) {
      console.log(`\n📊 Stats: ${sessionCount} active sessions`);
    }
  }, 30000); // Every 30 seconds

  console.log('✅ Server ready!');
  console.log('🌐 WebSocket URL: ws://localhost:8080');
  console.log('\n📝 Configuration:');
  console.log(`   STT: Deepgram Nova-2`);
  console.log(`   LLM: ${process.env.OPENAI_API_KEY ? 'OpenAI' : 'Not configured'}`);
  console.log(`   TTS: ${process.env.ELEVENLABS_API_KEY ? 'ElevenLabs' : 'Not configured'}`);
  console.log(`   MediaSoup: ${process.env.MEDIASOUP_SERVER_URL ? 'Enabled' : 'Disabled'}`);
  console.log('\n💡 Open examples/browser.html in your browser to test\n');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down server...');
    await server.close();
    console.log('👋 Server closed gracefully');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 Shutting down server...');
    await server.close();
    console.log('👋 Server closed gracefully');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
