/**
 * Simple Voice Agent Server Example
 * Ready to use with MediaSoup or standalone
 */

import { WebSocketServer, VoiceAgent } from '../src';
import { Agent, tool } from '../src/agents-sdk';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

// Create AI Agent with Tawk Agents SDK
const aiAgent = new Agent({
  name: 'VoiceAssistant',
  model: openai('gpt-4o'),
  instructions: 'You are a helpful voice assistant. Keep responses brief and natural for voice.',
  tools: {
    getTime: tool({
      description: 'Get the current time',
      parameters: z.object({}),
      execute: async () => {
        return { time: new Date().toLocaleTimeString() };
      },
    }),
  },
});

// Create WebSocket server
const server = new WebSocketServer({
  port: 8080,
  apiKeys: [process.env.API_KEY || 'demo-key'],
});

console.log('[Server] Voice Agent WebSocket server starting...');

// Handle connections
server.on('connection', async (sessionId, connection) => {
  console.log(`[${sessionId}] New connection`);

  // Create voice agent
  const voiceAgent = new VoiceAgent({
    stt: {
      provider: 'deepgram',
      apiKey: process.env.DEEPGRAM_API_KEY!,
      model: 'nova-2',
      streaming: true,
    },
    llm: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o',
      systemPrompt: 'You are a helpful voice assistant.',
    },
    tts: {
      provider: 'elevenlabs',
      apiKey: process.env.ELEVENLABS_API_KEY!,
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'default',
      streaming: true,
    },
    vad: {
      enabled: true,
      provider: 'energy',
      threshold: 0.5,
    },
    logging: {
      level: 'info',
      enableMetrics: true,
    },
  });

  await voiceAgent.initialize();

  // Wire up events
  connection.on('audio-data', async (audioData: Buffer) => {
    await voiceAgent.processAudio(audioData);
  });

  connection.on('message', async (message: any) => {
    if (message.type === 'conversation.item.create' && message.item?.content?.[0]?.text) {
      await voiceAgent.processText(message.item.content[0].text);
    }
    if (message.type === 'response.cancel') {
      await voiceAgent.interrupt();
    }
  });

  voiceAgent.on('audio.chunk', (chunk: Buffer) => {
    connection.sendAudio(chunk);
  });

  voiceAgent.on('transcription', (text: string) => {
    console.log(`[${sessionId}] User: ${text}`);
    connection.sendEvent({
      type: 'transcription.done',
      event_id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      transcript: text,
    } as any);
  });

  voiceAgent.on('response.text.delta', (delta: string) => {
    connection.sendEvent({
      type: 'response.text.delta',
      event_id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      delta,
    } as any);
  });

  voiceAgent.on('error', (error: Error) => {
    console.error(`[${sessionId}] Error:`, error);
    connection.sendError('voice_agent_error', error.message);
  });

  connection.on('close', async () => {
    console.log(`[${sessionId}] Connection closed`);
    await voiceAgent.stop();
  });

  // Send session created
  connection.sendEvent({
    type: 'session.created',
    event_id: `evt_${Date.now()}`,
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    session: {
      id: sessionId,
      object: 'session',
      model: 'gpt-4o',
      modalities: ['text', 'audio'],
      instructions: 'You are helpful.',
      voice: 'alloy',
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
    },
  } as any);
});

console.log(`
╔════════════════════════════════════════╗
║  Voice Agent SDK - Simple Server       ║
║                                        ║
║  WebSocket: ws://localhost:8080        ║
║  Status: Running ✓                     ║
╚════════════════════════════════════════╝
`);

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await server.close();
  process.exit(0);
});

