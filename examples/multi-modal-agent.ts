/**
 * Multi-Modal Voice Agent Example
 * 
 * Demonstrates BOTH input modes with DUAL output (text + audio):
 * 1. Audio Input → STT → LLM → TTS → Audio + Text Output
 * 2. Text Input → LLM → TTS → Audio + Text Output
 */

import { VoiceAgent } from '../src/voice-agent/voice-agent';
import { WebSocketServer } from '../src/transport/websocket-server';
import { tool, MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// Define Tools
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
    return {
      location,
      temperature: 72,
      condition: 'sunny',
      humidity: 45,
    };
  },
});

// ============================================
// Create Voice Agent Factory
// ============================================

function createVoiceAgent(sessionId: string) {
  const session = new MemorySession(sessionId);
  
  return new VoiceAgent({
    transport: { type: 'websocket' },
    
    // STT Provider (for audio input)
    stt: {
      provider: 'deepgram',
      apiKey: process.env.DEEPGRAM_API_KEY!,
      model: 'nova-2',
      streaming: true,
    },
    
    // agents-sdk (LLM layer)
    agent: {
      model: openai('gpt-4o'),
      name: 'MultiModalAssistant',
      instructions: `You are a helpful multi-modal assistant.

You can receive input as:
- Speech (converted to text via STT)
- Text (direct text input)

You ALWAYS respond with BOTH:
- Text (for display/logging)
- Speech (via TTS for voice playback)

Keep responses brief and natural for voice conversations.`,
      
      tools: {
        getCurrentTime,
        getWeather,
      },
      
      session,
      
      modelSettings: {
        temperature: 0.7,
        maxTokens: 150,
      },
    },
    
    // TTS Provider (ALWAYS generates audio output)
    tts: {
      provider: 'elevenlabs',
      apiKey: process.env.ELEVENLABS_API_KEY!,
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'default',
      streaming: true,
    },
    
    vad: { enabled: true },
    interruption: { enabled: true },
    
    logging: {
      level: 'info',
      enableMetrics: true,
    },
  });
}

// ============================================
// Setup WebSocket Server
// ============================================

const wsServer = new WebSocketServer({
  port: 8080,
});

wsServer.on('connection', async (ws, sessionId) => {
  console.log(`\n[${sessionId}] New connection`);
  console.log(`[${sessionId}] Multi-modal input supported:`);
  console.log(`[${sessionId}]   - Audio → STT → LLM → TTS → Audio + Text`);
  console.log(`[${sessionId}]   - Text → LLM → TTS → Audio + Text`);
  
  const voiceAgent = createVoiceAgent(sessionId);
  await voiceAgent.initialize();
  
  // ============================================
  // Handle Incoming Messages (Audio OR Text)
  // ============================================
  
  ws.on('message', async (message: any) => {
    try {
      // Mode 1: Binary Audio Data
      if (message instanceof Buffer) {
        console.log(`[${sessionId}] Received audio data (${message.length} bytes)`);
        await voiceAgent.processAudio(message);
        return;
      }
      
      // Mode 2: JSON Text Message
      const data = typeof message === 'string' ? JSON.parse(message) : message;
      
      if (data.type === 'text') {
        console.log(`[${sessionId}] Received text input: "${data.text}"`);
        await voiceAgent.processText(data.text);
      } else if (data.type === 'interrupt') {
        console.log(`[${sessionId}] Interruption requested`);
        await voiceAgent.interrupt();
      }
    } catch (error) {
      console.error(`[${sessionId}] Error processing message:`, error);
    }
  });
  
  // ============================================
  // Output Events (ALWAYS Text + Audio)
  // ============================================
  
  // Transcription (from STT or text input)
  voiceAgent.on('transcription', (text: string) => {
    console.log(`[${sessionId}] 📝 Transcription: "${text}"`);
    ws.send(JSON.stringify({
      type: 'transcription',
      text,
      timestamp: Date.now(),
    }));
  });
  
  // Response Text (streaming deltas)
  voiceAgent.on('response.text.delta', (delta: string) => {
    process.stdout.write(delta); // Show streaming response
    ws.send(JSON.stringify({
      type: 'response.text.delta',
      text: delta,
      timestamp: Date.now(),
    }));
  });
  
  // Response Text (full)
  voiceAgent.on('response.text', (text: string) => {
    console.log(`\n[${sessionId}] ✅ Full response: "${text}"`);
    ws.send(JSON.stringify({
      type: 'response.text',
      text,
      timestamp: Date.now(),
    }));
  });
  
  // Audio Output (ALWAYS generated via TTS)
  let audioChunkCount = 0;
  voiceAgent.on('audio.chunk', (chunk: Buffer) => {
    audioChunkCount++;
    console.log(`[${sessionId}] 🔊 Audio chunk ${audioChunkCount} (${chunk.length} bytes)`);
    
    // Send audio back to client for playback
    ws.send(chunk);
    
    // Also send metadata
    ws.send(JSON.stringify({
      type: 'audio.chunk',
      size: chunk.length,
      chunkNumber: audioChunkCount,
      timestamp: Date.now(),
    }));
  });
  
  voiceAgent.on('audio.started', (sentence: string) => {
    console.log(`[${sessionId}] 🎙️  TTS started for: "${sentence}"`);
    audioChunkCount = 0;
  });
  
  voiceAgent.on('audio.ended', (sentence: string) => {
    console.log(`[${sessionId}] 🎙️  TTS completed (${audioChunkCount} chunks)`);
  });
  
  // Tool calls
  voiceAgent.on('tool.call', (toolCall: any) => {
    console.log(`[${sessionId}] 🔧 Tool called: ${toolCall.name}`);
    console.log(`[${sessionId}]   Parameters:`, JSON.stringify(toolCall.parameters));
    console.log(`[${sessionId}]   Result:`, JSON.stringify(toolCall.result));
    
    ws.send(JSON.stringify({
      type: 'tool.call',
      tool: toolCall.name,
      params: toolCall.parameters,
      result: toolCall.result,
      timestamp: Date.now(),
    }));
  });
  
  // Metrics
  voiceAgent.on('metrics', (metrics: any) => {
    console.log(`[${sessionId}] 📊 Metrics:`, {
      totalLatency: `${metrics.totalLatency}ms`,
      sttLatency: `${metrics.sttLatency}ms`,
      llmLatency: `${metrics.llmLatency}ms`,
      ttsLatency: `${metrics.ttsLatency}ms`,
      turns: metrics.turns,
    });
  });
  
  // Errors
  voiceAgent.on('error', (error: Error) => {
    console.error(`[${sessionId}] ❌ Error:`, error.message);
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message,
      timestamp: Date.now(),
    }));
  });
  
  // ============================================
  // Handle Disconnection
  // ============================================
  
  ws.on('close', async () => {
    console.log(`[${sessionId}] Connection closed`);
    await voiceAgent.stop();
  });
});

console.log('\n' + '='.repeat(60));
console.log('🎙️  Multi-Modal Voice Agent Server');
console.log('='.repeat(60));
console.log('');
console.log('Server: ws://localhost:8080');
console.log('');
console.log('INPUT MODES:');
console.log('  1. Audio → STT → LLM → TTS → Audio + Text');
console.log('  2. Text → LLM → TTS → Audio + Text');
console.log('');
console.log('OUTPUT: ALWAYS both Text AND Audio');
console.log('');
console.log('Architecture:');
console.log('  STT: Deepgram Nova-2');
console.log('  LLM: OpenAI GPT-4o (via agents-sdk)');
console.log('  TTS: ElevenLabs');
console.log('');
console.log('Features:');
console.log('  ✅ Audio input support (binary data)');
console.log('  ✅ Text input support (JSON messages)');
console.log('  ✅ ALWAYS produces text + audio output');
console.log('  ✅ Tool calling (getCurrentTime, getWeather)');
console.log('  ✅ Conversation memory (session-based)');
console.log('  ✅ Interruption support');
console.log('');
console.log('Usage:');
console.log('  • Send audio: ws.send(audioBuffer)');
console.log('  • Send text:  ws.send(JSON.stringify({ type: "text", text: "Hello!" }))');
console.log('  • Interrupt:  ws.send(JSON.stringify({ type: "interrupt" }))');
console.log('');
console.log('='.repeat(60));
console.log('');

