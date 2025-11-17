/**
 * CORRECT ARCHITECTURE EXAMPLE
 * 
 * This shows the right way to use the Voice Agent SDK where
 * agents-sdk IS the LLM layer (not separate)
 */

import { VoiceAgent } from '../src/voice-agent/voice-agent';
import { WebSocketServer } from '../src/transport/websocket-server';
import { tool, MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// 1. Define Tools (using agents-sdk)
// ============================================

const getCurrentTime = tool({
  description: 'Get the current time',
  parameters: z.object({}),
  execute: async () => {
    return {
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
    };
  },
});

const getWeather = tool({
  description: 'Get weather for a location',
  parameters: z.object({
    location: z.string().describe('The city name'),
  }),
  execute: async ({ location }) => {
    // Mock weather data
    return {
      location,
      temperature: 72,
      condition: 'sunny',
      humidity: 45,
    };
  },
});

// ============================================
// 2. Create Voice Agent Factory
// ============================================

function createVoiceAgent(sessionId: string) {
  // Create session for conversation memory
  const session = new MemorySession(sessionId);
  
  return new VoiceAgent({
    transport: {
      type: 'websocket',
    },
    
    // STT Provider
    stt: {
      provider: 'deepgram',
      apiKey: process.env.DEEPGRAM_API_KEY!,
      model: 'nova-2',
      streaming: true,
    },
    
    // agents-sdk configuration (THIS IS THE LLM LAYER)
    agent: {
      model: openai('gpt-4o'),
      name: 'VoiceAssistant',
      instructions: `You are a helpful voice assistant.

Your capabilities:
- Tell the current time and date
- Provide weather information
- Answer general questions

Keep your responses brief and natural for voice conversations.
Always be friendly and helpful.`,
      
      // Tools from agents-sdk
      tools: {
        getCurrentTime,
        getWeather,
      },
      
      // Session management
      session,
      
      // Model settings
      modelSettings: {
        temperature: 0.7,
        maxTokens: 150, // Keep responses brief for voice
      },
    },
    
    // TTS Provider
    tts: {
      provider: 'elevenlabs',
      apiKey: process.env.ELEVENLABS_API_KEY!,
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'default',
      streaming: true,
    },
    
    // VAD (optional)
    vad: {
      enabled: true,
      silenceThresholdMs: 700,
      speechThresholdMs: 300,
    },
    
    // Interruption handling
    interruption: {
      enabled: true,
      cancelOnNewInput: true,
    },
    
    // Logging
    logging: {
      level: 'info',
      enableMetrics: true,
    },
  });
}

// ============================================
// 3. Setup WebSocket Server
// ============================================

const wsServer = new WebSocketServer({
  port: 8080,
});

wsServer.on('connection', async (ws, sessionId) => {
  console.log(`[${sessionId}] New connection`);
  
  // Create voice agent for this session
  const voiceAgent = createVoiceAgent(sessionId);
  await voiceAgent.initialize();
  
  // Handle incoming messages
  ws.on('message', async (message: any) => {
    try {
      // Handle binary audio data
      if (message instanceof Buffer) {
        await voiceAgent.processAudio(message);
        return;
      }
      
      // Handle JSON messages
      const data = typeof message === 'string' ? JSON.parse(message) : message;
      
      if (data.type === 'text') {
        // Process text directly (skip STT)
        await voiceAgent.processText(data.text);
      } else if (data.type === 'interrupt') {
        // Interrupt current response
        await voiceAgent.interrupt();
      }
    } catch (error) {
      console.error(`[${sessionId}] Error processing message:`, error);
    }
  });
  
  // Send audio back to client
  voiceAgent.on('audio.chunk', (chunk: Buffer) => {
    ws.send(chunk);
  });
  
  // Send events to client
  voiceAgent.on('transcription', (text: string) => {
    ws.send(JSON.stringify({
      type: 'transcription',
      text,
      timestamp: Date.now(),
    }));
  });
  
  voiceAgent.on('response.text.delta', (delta: string) => {
    ws.send(JSON.stringify({
      type: 'response.text.delta',
      text: delta,
      timestamp: Date.now(),
    }));
  });
  
  voiceAgent.on('response.text', (text: string) => {
    ws.send(JSON.stringify({
      type: 'response.text',
      text,
      timestamp: Date.now(),
    }));
  });
  
  voiceAgent.on('tool.call', (toolCall: any) => {
    console.log(`[${sessionId}] Tool called: ${toolCall.name}`);
    ws.send(JSON.stringify({
      type: 'tool.call',
      tool: toolCall.name,
      params: toolCall.parameters,
      result: toolCall.result,
      timestamp: Date.now(),
    }));
  });
  
  voiceAgent.on('metrics', (metrics: any) => {
    console.log(`[${sessionId}] Metrics:`, metrics);
  });
  
  voiceAgent.on('error', (error: Error) => {
    console.error(`[${sessionId}] Error:`, error);
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message,
      timestamp: Date.now(),
    }));
  });
  
  // Handle disconnection
  ws.on('close', async () => {
    console.log(`[${sessionId}] Connection closed`);
    await voiceAgent.stop();
  });
});

console.log('✅ Voice Agent Server running on ws://localhost:8080');
console.log('');
console.log('Architecture:');
console.log('  STT (Deepgram) → agents-sdk (OpenAI GPT-4o) → TTS (ElevenLabs)');
console.log('');
console.log('Features:');
console.log('  • Tool calling (getCurrentTime, getWeather)');
console.log('  • Conversation memory (session-based)');
console.log('  • Voice activity detection');
console.log('  • Interruption support');
console.log('');
console.log('Test it:');
console.log('  1. Connect via WebSocket: ws://localhost:8080');
console.log('  2. Send audio data (Buffer) for STT processing');
console.log('  3. Or send JSON: { "type": "text", "text": "What time is it?" }');
console.log('  4. Receive audio chunks and events back');

