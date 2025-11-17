/**
 * OpenAI All Models Demo Server
 * 
 * Demonstrates how to use the Voice Agent SDK with ALL OpenAI models:
 * - GPT-4o (latest, best for voice)
 * - GPT-4o-mini (fast, cost-effective)
 * - GPT-4-turbo (powerful, multimodal)
 * - GPT-3.5-turbo (fast, economical)
 * 
 * Features:
 * - Multi-modal input (audio + text)
 * - Dual output (text + audio always)
 * - Tool calling
 * - Session management
 * - Model switching
 */

import { VoiceAgent } from '../src/voice-agent/voice-agent';
import { WebSocketServer } from '../src/transport/websocket-server';
import { tool, MemorySession } from '@tawk/voice-agents-sdk/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

// ============================================
// OpenAI Model Configurations
// ============================================

const OPENAI_MODELS = {
  // GPT-4o - Latest, optimized for voice and speed
  'gpt-4o': {
    name: 'GPT-4o (Latest)',
    description: 'Best for voice conversations, fast, multimodal',
    maxTokens: 4096,
    temperature: 0.7,
  },
  
  // GPT-4o-mini - Fast and cost-effective
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    description: 'Fast and economical, great for simple tasks',
    maxTokens: 16384,
    temperature: 0.7,
  },
  
  // GPT-4-turbo - Powerful multimodal
  'gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    description: 'Powerful, supports vision and tools',
    maxTokens: 4096,
    temperature: 0.7,
  },
  
  // GPT-3.5-turbo - Fast and economical
  'gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    description: 'Fast and economical for simple conversations',
    maxTokens: 4096,
    temperature: 0.7,
  },
};

// ============================================
// Tools (Work with all models)
// ============================================

const getCurrentTime = tool({
  description: 'Get the current date and time',
  parameters: z.object({}),
  execute: async () => {
    const now = new Date();
    return {
      time: now.toLocaleTimeString('en-US'),
      date: now.toLocaleDateString('en-US'),
      timestamp: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  },
});

const getWeather = tool({
  description: 'Get weather information for a location',
  parameters: z.object({
    location: z.string().describe('City name or location'),
    units: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature units'),
  }),
  execute: async ({ location, units = 'fahrenheit' }) => {
    // Mock weather data (in production, call real weather API)
    const mockWeather = {
      location,
      temperature: units === 'celsius' ? 22 : 72,
      units,
      condition: 'Partly cloudy',
      humidity: 65,
      windSpeed: 10,
      forecast: 'Clear skies expected',
    };
    return mockWeather;
  },
});

const calculate = tool({
  description: 'Perform mathematical calculations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt']),
    a: z.number().describe('First number'),
    b: z.number().optional().describe('Second number (not needed for sqrt)'),
  }),
  execute: async ({ operation, a, b }) => {
    let result: number;
    
    switch (operation) {
      case 'add':
        result = a + (b || 0);
        break;
      case 'subtract':
        result = a - (b || 0);
        break;
      case 'multiply':
        result = a * (b || 1);
        break;
      case 'divide':
        result = a / (b || 1);
        break;
      case 'power':
        result = Math.pow(a, b || 2);
        break;
      case 'sqrt':
        result = Math.sqrt(a);
        break;
      default:
        throw new Error('Unknown operation');
    }
    
    return {
      operation,
      input: { a, b },
      result,
      expression: b ? `${a} ${operation} ${b} = ${result}` : `${operation}(${a}) = ${result}`,
    };
  },
});

const searchKnowledge = tool({
  description: 'Search knowledge base for information',
  parameters: z.object({
    query: z.string().describe('Search query'),
    category: z.enum(['general', 'technical', 'business']).optional(),
  }),
  execute: async ({ query, category = 'general' }) => {
    // Mock knowledge base search
    return {
      query,
      category,
      results: [
        `Found information about: ${query}`,
        `Category: ${category}`,
        `This is mock data. In production, integrate with real knowledge base.`,
      ],
      sources: ['Knowledge Base', 'Documentation'],
    };
  },
});

// ============================================
// Voice Agent Factory for Different Models
// ============================================

function createVoiceAgent(sessionId: string, modelName: keyof typeof OPENAI_MODELS = 'gpt-4o') {
  const modelConfig = OPENAI_MODELS[modelName];
  const session = new MemorySession(sessionId);
  
  console.log(`[${sessionId}] Creating agent with model: ${modelConfig.name}`);
  
  return new VoiceAgent({
    transport: { type: 'websocket' },
    
    // STT Provider
    stt: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'whisper-1',
    },
    
    // Agent with OpenAI model
    agent: {
      model: openai(modelName),
      name: `VoiceAssistant-${modelName}`,
      instructions: `You are a helpful AI voice assistant powered by ${modelConfig.name}.

Your capabilities:
- Answer questions naturally
- Perform calculations
- Get current time and weather
- Search knowledge base
- Have natural conversations

Model info: ${modelConfig.description}

Guidelines:
- Keep responses brief for voice (2-3 sentences)
- Be friendly and conversational
- Use tools when appropriate
- Mention which model you are if asked`,
      
      // All tools available
      tools: {
        getCurrentTime,
        getWeather,
        calculate,
        searchKnowledge,
      },
      
      // Session for conversation memory
      session,
      
      // Model-specific settings
      modelSettings: {
        temperature: modelConfig.temperature,
        maxTokens: Math.min(modelConfig.maxTokens, 150), // Keep brief for voice
      },
    },
    
    // TTS Provider (OpenAI)
    tts: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'tts-1', // or 'tts-1-hd' for higher quality
      // voiceId: 'alloy', // Options: alloy, echo, fable, onyx, nova, shimmer
    },
    
    // VAD Configuration
    vad: {
      enabled: true,
      silenceThresholdMs: 700,
      speechThresholdMs: 300,
    },
    
    // Interruption Support
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
// WebSocket Server Setup
// ============================================

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const wsServer = new WebSocketServer({ port: PORT });

// Track active sessions
const activeSessions = new Map<string, {
  agent: VoiceAgent;
  model: string;
  startTime: number;
  messageCount: number;
}>();

wsServer.on('connection', async (ws, sessionId) => {
  console.log('\n' + '='.repeat(70));
  console.log(`[${sessionId}] 🎙️  New Connection`);
  console.log('='.repeat(70));
  
  // Default to GPT-4o
  let currentModel: keyof typeof OPENAI_MODELS = 'gpt-4o';
  let voiceAgent = createVoiceAgent(sessionId, currentModel);
  
  try {
    await voiceAgent.initialize();
    
    // Track session
    activeSessions.set(sessionId, {
      agent: voiceAgent,
      model: currentModel,
      startTime: Date.now(),
      messageCount: 0,
    });
    
    console.log(`[${sessionId}] ✅ Agent initialized with ${OPENAI_MODELS[currentModel].name}`);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'system',
      message: `Connected! Using ${OPENAI_MODELS[currentModel].name}`,
      models: Object.keys(OPENAI_MODELS),
      commands: {
        'switch_model': 'Switch to different OpenAI model',
        'get_info': 'Get current model information',
        'clear_history': 'Clear conversation history',
      },
    }));
    
  } catch (error: any) {
    console.error(`[${sessionId}] ❌ Initialization failed:`, error.message);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to initialize voice agent',
      error: error.message,
    }));
    return;
  }
  
  // ============================================
  // Handle Incoming Messages
  // ============================================
  
  ws.on('message', async (message: any) => {
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) return;
    
    try {
      // Binary audio data
      if (message instanceof Buffer) {
        console.log(`[${sessionId}] 🎤 Received audio (${message.length} bytes)`);
        sessionInfo.messageCount++;
        await voiceAgent.processAudio(message);
        return;
      }
      
      // JSON messages
      const data = typeof message === 'string' ? JSON.parse(message) : message;
      
      // Handle different message types
      switch (data.type) {
        case 'text':
          console.log(`[${sessionId}] 💬 Text input: "${data.text}"`);
          sessionInfo.messageCount++;
          await voiceAgent.processText(data.text);
          break;
          
        case 'interrupt':
          console.log(`[${sessionId}] ⏸️  Interruption requested`);
          await voiceAgent.interrupt();
          break;
          
        case 'switch_model':
          const newModel = data.model as keyof typeof OPENAI_MODELS;
          if (OPENAI_MODELS[newModel]) {
            console.log(`[${sessionId}] 🔄 Switching model: ${currentModel} → ${newModel}`);
            
            // Stop current agent
            await voiceAgent.stop();
            
            // Create new agent with different model
            currentModel = newModel;
            voiceAgent = createVoiceAgent(sessionId, currentModel);
            await voiceAgent.initialize();
            
            // Update session
            sessionInfo.agent = voiceAgent;
            sessionInfo.model = currentModel;
            
            // Re-attach event listeners (see below)
            attachEventListeners();
            
            ws.send(JSON.stringify({
              type: 'system',
              message: `Switched to ${OPENAI_MODELS[newModel].name}`,
              model: newModel,
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid model',
              availableModels: Object.keys(OPENAI_MODELS),
            }));
          }
          break;
          
        case 'get_info':
          const info = {
            sessionId,
            model: currentModel,
            modelInfo: OPENAI_MODELS[currentModel],
            messageCount: sessionInfo.messageCount,
            uptime: Date.now() - sessionInfo.startTime,
            metrics: voiceAgent.getMetrics(),
          };
          console.log(`[${sessionId}] ℹ️  Info requested`);
          ws.send(JSON.stringify({
            type: 'info',
            ...info,
          }));
          break;
          
        case 'clear_history':
          console.log(`[${sessionId}] 🗑️  Clearing conversation history`);
          await voiceAgent.clearHistory();
          ws.send(JSON.stringify({
            type: 'system',
            message: 'Conversation history cleared',
          }));
          break;
          
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Unknown message type',
          }));
      }
    } catch (error: any) {
      console.error(`[${sessionId}] ❌ Error processing message:`, error.message);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message,
      }));
    }
  });
  
  // ============================================
  // Voice Agent Event Listeners
  // ============================================
  
  function attachEventListeners() {
    // Transcription (from STT or text input)
    voiceAgent.on('transcription', (text: string) => {
      console.log(`[${sessionId}] 📝 Transcription: "${text}"`);
      ws.send(JSON.stringify({
        type: 'transcription',
        text,
        timestamp: Date.now(),
      }));
    });
    
    // Response text (streaming)
    voiceAgent.on('response.text.delta', (delta: string) => {
      ws.send(JSON.stringify({
        type: 'response.text.delta',
        text: delta,
        timestamp: Date.now(),
      }));
    });
    
    // Response text (complete)
    voiceAgent.on('response.text', (text: string) => {
      console.log(`[${sessionId}] 💡 Response: "${text.substring(0, 100)}..."`);
      ws.send(JSON.stringify({
        type: 'response.text',
        text,
        timestamp: Date.now(),
      }));
    });
    
    // Audio output
    let audioChunkCount = 0;
    voiceAgent.on('audio.started', (sentence: string) => {
      console.log(`[${sessionId}] 🔊 TTS started`);
      audioChunkCount = 0;
    });
    
    voiceAgent.on('audio.chunk', (chunk: Buffer) => {
      audioChunkCount++;
      // Send audio to client
      ws.send(chunk);
    });
    
    voiceAgent.on('audio.ended', () => {
      console.log(`[${sessionId}] ✅ TTS completed (${audioChunkCount} chunks)`);
    });
    
    // Tool calls
    voiceAgent.on('tool.call', (toolCall: any) => {
      console.log(`[${sessionId}] 🔧 Tool: ${toolCall.name}`);
      console.log(`[${sessionId}]   Params:`, JSON.stringify(toolCall.parameters));
      console.log(`[${sessionId}]   Result:`, JSON.stringify(toolCall.result));
      
      ws.send(JSON.stringify({
        type: 'tool.call',
        tool: toolCall.name,
        parameters: toolCall.parameters,
        result: toolCall.result,
        timestamp: Date.now(),
      }));
    });
    
    // Metrics
    voiceAgent.on('metrics', (metrics: any) => {
      console.log(`[${sessionId}] 📊 Latency: ${metrics.totalLatency}ms (STT: ${metrics.sttLatency}ms, LLM: ${metrics.llmLatency}ms, TTS: ${metrics.ttsLatency}ms)`);
      
      ws.send(JSON.stringify({
        type: 'metrics',
        ...metrics,
        timestamp: Date.now(),
      }));
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
  }
  
  // Attach listeners initially
  attachEventListeners();
  
  // ============================================
  // Handle Disconnection
  // ============================================
  
  ws.on('close', async () => {
    const sessionInfo = activeSessions.get(sessionId);
    if (sessionInfo) {
      const duration = Date.now() - sessionInfo.startTime;
      console.log('\n' + '='.repeat(70));
      console.log(`[${sessionId}] 👋 Connection closed`);
      console.log(`[${sessionId}]   Duration: ${Math.round(duration / 1000)}s`);
      console.log(`[${sessionId}]   Messages: ${sessionInfo.messageCount}`);
      console.log(`[${sessionId}]   Model: ${OPENAI_MODELS[sessionInfo.model as keyof typeof OPENAI_MODELS].name}`);
      console.log('='.repeat(70) + '\n');
      
      await voiceAgent.stop();
      activeSessions.delete(sessionId);
    }
  });
});

// ============================================
// Server Info & Status
// ============================================

console.log('\n' + '='.repeat(70));
console.log('🎙️  OpenAI All Models Voice Agent Server');
console.log('='.repeat(70));
console.log('');
console.log('Server:     ws://localhost:' + PORT);
console.log('Status:     ✅ Running');
console.log('');
console.log('OpenAI Models Available:');
Object.entries(OPENAI_MODELS).forEach(([key, config]) => {
  console.log(`  • ${key.padEnd(15)} - ${config.description}`);
});
console.log('');
console.log('Features:');
console.log('  ✅ Multi-modal input (audio + text)');
console.log('  ✅ Dual output (text + audio always)');
console.log('  ✅ Model switching (runtime)');
console.log('  ✅ Tool calling (4 tools available)');
console.log('  ✅ Session management');
console.log('  ✅ Interruption support');
console.log('  ✅ Real-time metrics');
console.log('');
console.log('Tools Available:');
console.log('  🕐 getCurrentTime  - Get current date/time');
console.log('  🌤️  getWeather     - Get weather information');
console.log('  🧮 calculate       - Perform math calculations');
console.log('  🔍 searchKnowledge - Search knowledge base');
console.log('');
console.log('Client Commands:');
console.log('  • Send audio:      ws.send(audioBuffer)');
console.log('  • Send text:       ws.send(JSON.stringify({ type: "text", text: "Hello" }))');
console.log('  • Switch model:    ws.send(JSON.stringify({ type: "switch_model", model: "gpt-4o-mini" }))');
console.log('  • Get info:        ws.send(JSON.stringify({ type: "get_info" }))');
console.log('  • Clear history:   ws.send(JSON.stringify({ type: "clear_history" }))');
console.log('  • Interrupt:       ws.send(JSON.stringify({ type: "interrupt" }))');
console.log('');
console.log('Example Usage:');
console.log('  1. Connect: const ws = new WebSocket("ws://localhost:' + PORT + '")');
console.log('  2. Send text: ws.send(JSON.stringify({ type: "text", text: "What time is it?" }))');
console.log('  3. Receive: Listen for text and audio responses');
console.log('  4. Switch: ws.send(JSON.stringify({ type: "switch_model", model: "gpt-4o-mini" }))');
console.log('');
console.log('='.repeat(70));
console.log('');

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  
  for (const [sessionId, sessionInfo] of activeSessions) {
    console.log(`  Stopping session: ${sessionId}`);
    await sessionInfo.agent.stop();
  }
  
  activeSessions.clear();
  console.log('✅ All sessions closed');
  process.exit(0);
});

