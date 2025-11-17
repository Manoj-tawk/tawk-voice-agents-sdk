/**
 * MediaSoup Integration Example
 * 
 * Shows how to integrate Voice Agent SDK with MediaSoup server
 * for server-to-server voice communication
 */

import { WebRTCServer, WebSocketServer, VoiceAgent } from '../src';
import { Agent, tool, run } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // WebRTC configuration for MediaSoup
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
    audioCodec: 'opus' as const,
    sampleRate: 24000 as const,
  },

  // WebSocket fallback
  websocket: {
    port: 8080,
    apiKeys: [process.env.API_KEY || 'demo-key'],
  },

  // Voice Agent configuration
  voiceAgent: {
    stt: {
      provider: 'deepgram' as const,
      apiKey: process.env.DEEPGRAM_API_KEY!,
      model: 'nova-2',
      language: 'en-US',
      streaming: true,
    },
    llm: {
      provider: 'openai' as const,
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o',
      temperature: 0.7,
      systemPrompt: 'You are a helpful voice assistant integrated with MediaSoup.',
    },
    tts: {
      provider: 'elevenlabs' as const,
      apiKey: process.env.ELEVENLABS_API_KEY!,
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'default',
      model: 'turbo-v2.5',
      streaming: true,
    },
    vad: {
      enabled: true,
      provider: 'energy' as const,
      threshold: 0.5,
    },
    interruption: {
      enabled: true,
    },
    logging: {
      level: 'info' as const,
      enableMetrics: true,
    },
  },
};

// ============================================
// AGENT SETUP with Tawk Agents SDK
// ============================================

// Define tools
const transferToHuman = tool({
  description: 'Transfer the conversation to a human agent',
  parameters: z.object({
    reason: z.string().describe('Reason for transfer'),
    department: z.enum(['sales', 'support', 'technical']).describe('Which department'),
  }),
  execute: async ({ reason, department }) => {
    console.log(`[Tool] Transferring to ${department}: ${reason}`);
    return {
      success: true,
      message: `Transferring you to ${department}. Please hold...`,
      estimatedWaitTime: '2 minutes',
    };
  },
});

const getCallInfo = tool({
  description: 'Get information about the current call',
  parameters: z.object({}),
  execute: async () => {
    return {
      callDuration: '5 minutes 23 seconds',
      quality: 'excellent',
      transport: 'WebRTC/MediaSoup',
    };
  },
});

// Create AI Agent
const voiceAssistant = new Agent({
  name: 'VoiceAssistant',
  model: openai('gpt-4o'),
  instructions: `You are a professional voice assistant integrated with MediaSoup for high-quality audio.
  
Your capabilities:
- Answer questions clearly and concisely
- Transfer to human agents when needed
- Provide call information

Keep responses short (1-2 sentences) for voice interactions.`,
  tools: {
    transferToHuman,
    getCallInfo,
  },
  modelSettings: {
    temperature: 0.7,
    maxTokens: 150,
  },
});

// ============================================
// MEDIASOUP WEBRTC SERVER
// ============================================

const webrtcServer = new WebRTCServer(CONFIG.webrtc);

console.log('[MediaSoup] WebRTC server initialized');

// Handle new RTC connections
webrtcServer.on('connection-created', async (sessionId, connection) => {
  console.log(`[MediaSoup] New RTC connection: ${sessionId}`);

  // Create voice agent for this session
  const voiceAgent = new VoiceAgent(CONFIG.voiceAgent);
  await voiceAgent.initialize();

  // Handle incoming audio from MediaSoup
  connection.on('audio-data', async (audioData: Buffer) => {
    await voiceAgent.processAudio(audioData);
  });

  // Send audio back to MediaSoup
  voiceAgent.on('audio.chunk', (chunk: Buffer) => {
    connection.sendAudio(chunk);
  });

  // Handle transcription
  voiceAgent.on('transcription', (text: string) => {
    console.log(`[${sessionId}] User: ${text}`);
    
    // Send event via datachannel
    connection.sendMessage({
      type: 'transcription.done',
      transcript: text,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle response text
  voiceAgent.on('response.text.delta', (delta: string) => {
    connection.sendMessage({
      type: 'response.text.delta',
      delta,
    });
  });

  // Handle tool calls
  voiceAgent.on('tool.call', async (toolCall: any) => {
    console.log(`[${sessionId}] Tool call: ${toolCall.name}`);
    
    connection.sendMessage({
      type: 'response.tool.call',
      tool: toolCall.name,
      arguments: toolCall.parameters,
    });
  });

  // Handle errors
  voiceAgent.on('error', (error: Error) => {
    console.error(`[${sessionId}] Error:`, error);
    
    connection.sendMessage({
      type: 'error',
      error: {
        code: 'voice_agent_error',
        message: error.message,
      },
    });
  });

  // Handle metrics
  voiceAgent.on('metrics', (metrics: any) => {
    console.log(`[${sessionId}] Metrics:`, metrics);
  });

  // Handle disconnection
  connection.on('closed', async () => {
    console.log(`[${sessionId}] RTC connection closed`);
    await voiceAgent.stop();
  });

  // Send session created event
  connection.sendMessage({
    type: 'session.created',
    session: {
      id: sessionId,
      transport: 'webrtc',
      codec: CONFIG.webrtc.audioCodec,
      sampleRate: CONFIG.webrtc.sampleRate,
    },
  });
});

webrtcServer.on('connection-connected', (sessionId) => {
  console.log(`[MediaSoup] RTC connection established: ${sessionId}`);
});

webrtcServer.on('connection-disconnected', (sessionId) => {
  console.log(`[MediaSoup] RTC connection disconnected: ${sessionId}`);
});

webrtcServer.on('error', (sessionId, error) => {
  console.error(`[MediaSoup] Error for ${sessionId}:`, error);
});

// ============================================
// WEBSOCKET SERVER (FALLBACK)
// ============================================

const wsServer = new WebSocketServer(CONFIG.websocket);

console.log(`[WebSocket] Server listening on port ${CONFIG.websocket.port}`);

// Handle WebSocket connections
wsServer.on('connection', async (sessionId, connection) => {
  console.log(`[WebSocket] New connection: ${sessionId}`);

  // Create voice agent
  const voiceAgent = new VoiceAgent(CONFIG.voiceAgent);
  await voiceAgent.initialize();

  // Handle incoming audio
  connection.on('audio-data', async (audioData: Buffer) => {
    await voiceAgent.processAudio(audioData);
  });

  // Handle incoming messages
  connection.on('message', async (message: any) => {
    switch (message.type) {
      case 'conversation.item.create':
        if (message.item?.content?.[0]?.text) {
          await voiceAgent.processText(message.item.content[0].text);
        }
        break;

      case 'response.cancel':
        await voiceAgent.interrupt();
        break;

      case 'session.update':
        // Update session configuration
        if (message.session?.instructions) {
          voiceAgent.setSystemPrompt(message.session.instructions);
        }
        break;
    }
  });

  // Send audio back
  voiceAgent.on('audio.chunk', (chunk: Buffer) => {
    connection.sendAudio(chunk);
  });

  // Send events
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
      text: delta,
    } as any);
  });

  voiceAgent.on('tool.call', async (toolCall: any) => {
    console.log(`[${sessionId}] Tool call: ${toolCall.name}`);
    connection.sendEvent({
      type: 'response.tool.call',
      event_id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      item_id: toolCall.id,
      call_id: toolCall.id,
      name: toolCall.name,
      arguments: JSON.stringify(toolCall.parameters),
    } as any);
  });

  voiceAgent.on('error', (error: Error) => {
    console.error(`[${sessionId}] Error:`, error);
    connection.sendError('voice_agent_error', error.message);
  });

  // Handle close
  connection.on('close', async () => {
    console.log(`[${sessionId}] WebSocket closed`);
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
      model: CONFIG.voiceAgent.llm.model,
      modalities: ['text', 'audio'],
      instructions: CONFIG.voiceAgent.llm.systemPrompt || '',
      voice: 'alloy',
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: {
        enabled: true,
        model: CONFIG.voiceAgent.stt.model || 'nova-2',
      },
      turn_detection: {
        type: 'server_vad',
        threshold: CONFIG.voiceAgent.vad?.threshold || 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 700,
      },
      tools: [],
      tool_choice: 'auto',
      temperature: CONFIG.voiceAgent.llm.temperature || 0.7,
      max_response_output_tokens: 'inf',
    },
  } as any);
});

wsServer.on('disconnection', (sessionId) => {
  console.log(`[WebSocket] Disconnection: ${sessionId}`);
});

wsServer.on('error', (error) => {
  console.error('[WebSocket] Server error:', error);
});

// ============================================
// SIGNALING ENDPOINT for MediaSoup
// ============================================

/**
 * Example signaling flow for MediaSoup integration:
 * 
 * 1. MediaSoup server sends offer:
 *    POST /voice/connect
 *    { sessionId, offer: { type: 'offer', sdp: '...' } }
 * 
 * 2. Voice Agent SDK creates WebRTC connection and returns answer:
 *    { sessionId, answer: { type: 'answer', sdp: '...' } }
 * 
 * 3. ICE candidates exchanged via same endpoint:
 *    POST /voice/ice
 *    { sessionId, candidate: { ... } }
 */

// Express/HTTP server would handle signaling
// This is a simplified example showing the flow

export async function handleMediaSoupOffer(sessionId: string, offerSdp: string) {
  // Create WebRTC connection
  const connection = webrtcServer.createConnection(sessionId);
  
  // Handle offer and get answer
  const answer = await connection.handleOffer(offerSdp);
  
  return {
    sessionId,
    answer,
  };
}

export async function handleMediaSoupIceCandidate(sessionId: string, candidate: any) {
  const connection = webrtcServer.getConnection(sessionId);
  
  if (!connection) {
    throw new Error(`No connection found for session: ${sessionId}`);
  }
  
  await connection.handleIceCandidate(candidate);
  
  return { success: true };
}

// ============================================
// SHUTDOWN HANDLER
// ============================================

process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down gracefully...');
  
  webrtcServer.closeAll();
  await wsServer.close();
  
  console.log('[Server] Shutdown complete');
  process.exit(0);
});

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║    Voice Agent SDK - MediaSoup Integration                ║
║                                                           ║
║    WebRTC Server: Ready for MediaSoup connections        ║
║    WebSocket Server: ws://localhost:${CONFIG.websocket.port}                ║
║                                                           ║
║    Status: Running ✓                                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

[Info] Send WebRTC offers to /voice/connect
[Info] Send ICE candidates to /voice/ice
[Info] WebSocket clients can connect directly
[Info] Press Ctrl+C to stop

`);

