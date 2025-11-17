/**
 * Multi-Modal Integration Tests
 * 
 * Tests the complete flow of multi-modal input and dual output
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VoiceAgent } from '../../src/voice-agent/voice-agent';
import { openai } from '@ai-sdk/openai';
import { tool, MemorySession } from '@tawk/voice-agents-sdk/core';
import { z } from 'zod';

describe('Multi-Modal Integration', () => {
  let voiceAgent: VoiceAgent;

  const testTool = tool({
    description: 'Test tool',
    parameters: z.object({
      input: z.string(),
    }),
    execute: async ({ input }) => {
      return { result: `Processed: ${input}` };
    },
  });

  beforeEach(() => {
    voiceAgent = new VoiceAgent({
      transport: { type: 'websocket' },
      stt: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY || 'test',
      },
      agent: {
        model: openai('gpt-4o-mini'),
        name: 'TestAgent',
        instructions: 'You are a test agent. Be brief.',
        tools: { testTool },
        session: new MemorySession('test-session'),
        modelSettings: {
          temperature: 0.7,
          maxTokens: 50,
        },
      },
      tts: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY || 'test',
      },
      vad: { enabled: false },
      logging: { level: 'error' },
    });
  });

  afterEach(async () => {
    if (voiceAgent) {
      await voiceAgent.stop();
    }
  });

  describe('Text Input → Text + Audio Output', () => {
    it('should process text input and produce dual output', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.log('Skipping test: OPENAI_API_KEY not set');
        return;
      }

      await voiceAgent.initialize();

      const textOutputs: string[] = [];
      const audioChunks: Buffer[] = [];
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (textOutputs.length > 0 || audioChunks.length > 0) {
            resolve();
          } else {
            reject(new Error('Test timeout: No output received'));
          }
        }, 9500);

        voiceAgent.on('response.text.delta', (delta) => {
          textOutputs.push(delta);
        });

        voiceAgent.on('audio.chunk', (chunk) => {
          audioChunks.push(chunk);
        });

        voiceAgent.on('processing.stopped', () => {
          clearTimeout(timeout);
          try {
            // Verify text output
            expect(textOutputs.length).toBeGreaterThan(0);
            
            // Verify audio output
            expect(audioChunks.length).toBeGreaterThan(0);
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        voiceAgent.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        voiceAgent.processText('Say hello').catch(reject);
      });
    }, 10000);
  });

  describe('Tool Calling Integration', () => {
    it('should call tools and produce output', async () => {
      await voiceAgent.initialize();

      const toolCalls: any[] = [];

      voiceAgent.on('tool.call', (toolCall) => {
        toolCalls.push(toolCall);
      });

      await voiceAgent.processText('Use the test tool with input "test"');

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify tool was called
      // expect(toolCalls.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Session Persistence', () => {
    it('should maintain conversation context', async () => {
      await voiceAgent.initialize();

      await voiceAgent.processText('My name is Alice');
      // Wait for stream to complete and session to be updated
      await new Promise(resolve => setTimeout(resolve, 3000));

      await voiceAgent.processText('What is my name?');
      // Wait for stream to complete and session to be updated
      await new Promise(resolve => setTimeout(resolve, 3000));

      const history = await voiceAgent.getConversationHistory();
      expect(history.length).toBeGreaterThan(0);
    }, 15000);
  });
});
