/**
 * TEST 01: Basic Agent (Unit Tests)
 * 
 * Tests basic agent functionality with mocked responses:
 * - Agent creation
 * - Simple tool calling
 * - Token tracking
 * - Context injection
 */

import { Agent, run, setDefaultModel, tool } from '@tawk-agents-sdk/core';
import { generateText } from 'ai';
import { z } from 'zod';

// Mock AI SDK
jest.mock('ai');
const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;

describe('Basic Agent Tests', () => {
  const mockModel = { modelId: 'test-model' } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    setDefaultModel(mockModel);
  });

  describe('Agent Creation', () => {
    it('should create an agent with name and instructions', () => {
      const agent = new Agent({
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('Test Agent');
    });

    it('should create agent with custom model', () => {
      const customModel = { modelId: 'custom-model' } as any;
      const agent = new Agent({
        name: 'Custom Agent',
        instructions: 'Test',
        model: customModel,
      });

      expect(agent).toBeDefined();
    });

    it('should create agent with tools', () => {
      const testTool = tool({
        description: 'Test tool',
        parameters: z.object({ input: z.string() }),
        execute: async () => ({ result: 'ok' }),
      });

      const agent = new Agent({
        name: 'Tool Agent',
        instructions: 'Use tools',
        tools: { testTool },
      });

      expect(agent).toBeDefined();
    });
  });

  describe('Basic Agent Execution', () => {
    it('should run agent and return text response', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Hello! I am a helpful assistant.',
        usage: {
          promptTokens: 10,
          completionTokens: 8,
          totalTokens: 18,
        },
        finishReason: 'stop',
        steps: [],
      } as any);

      const agent = new Agent({
        name: 'Simple Agent',
        instructions: 'You are helpful',
      });

      const result = await run(agent, 'Hello!');

      expect(result.finalOutput).toBe('Hello! I am a helpful assistant.');
      expect(result.metadata.totalTokens).toBe(18);
      expect(result.metadata.promptTokens).toBe(10);
      expect(result.metadata.completionTokens).toBe(8);
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it('should handle multi-turn conversations', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: 'stop',
        steps: [],
      } as any);

      const agent = new Agent({
        name: 'Chat Agent',
        instructions: 'You are helpful',
      });

      const result1 = await run(agent, 'First message');
      const result2 = await run(agent, 'Second message');

      expect(result1.finalOutput).toBe('Response');
      expect(result2.finalOutput).toBe('Response');
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
    });
  });

  describe('Tool Calling', () => {
    it('should call tool and return result', async () => {
      const weatherTool = tool({
        description: 'Get weather',
        parameters: z.object({ city: z.string() }),
        execute: async ({ city }) => ({
          city,
          temperature: 72,
          conditions: 'Sunny',
        }),
      });

      mockGenerateText.mockResolvedValue({
        text: 'The weather in San Francisco is 72°F and Sunny.',
        toolCalls: [
          {
            toolCallId: 'call_123',
            toolName: 'weatherTool',
            args: { city: 'San Francisco' },
          },
        ],
        toolResults: [
          {
            toolCallId: 'call_123',
            toolName: 'weatherTool',
            result: { city: 'San Francisco', temperature: 72, conditions: 'Sunny' },
          },
        ],
        usage: { promptTokens: 20, completionTokens: 15, totalTokens: 35 },
        finishReason: 'stop',
        steps: [],
      } as any);

      const agent = new Agent({
        name: 'Weather Agent',
        instructions: 'Help with weather',
        tools: { weatherTool },
      });

      const result = await run(agent, 'What is the weather in San Francisco?');

      expect(result.finalOutput).toContain('72');
      expect(result.finalOutput).toContain('Sunny');
      expect(mockGenerateText).toHaveBeenCalled();
    });
  });

  describe('Context Injection', () => {
    it('should inject context into tool execution', async () => {
      const contextTool = tool({
        description: 'Use context',
        parameters: z.object({ query: z.string() }),
        execute: async ({ query }, contextWrapper) => {
          const userId = contextWrapper?.context?.userId;
          return { query, userId };
        },
      });

      mockGenerateText.mockResolvedValue({
        text: 'Context used',
        toolCalls: [
          {
            toolCallId: 'call_456',
            toolName: 'contextTool',
            args: { query: 'test' },
          },
        ],
        toolResults: [
          {
            toolCallId: 'call_456',
            toolName: 'contextTool',
            result: { query: 'test', userId: 'user-123' },
          },
        ],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        steps: [],
      } as any);

      const agent = new Agent({
        name: 'Context Agent',
        instructions: 'Use context',
        tools: { contextTool },
      });

      const result = await run(agent, 'Test', {
        context: { userId: 'user-123', role: 'admin' },
      });

      expect(result.finalOutput).toBe('Context used');
    });
  });

  describe('Token Tracking', () => {
    it('should track tokens correctly', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Response',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        finishReason: 'stop',
        steps: [],
      } as any);

      const agent = new Agent({
        name: 'Token Agent',
        instructions: 'Track tokens',
      });

      const result = await run(agent, 'Count my tokens');

      expect(result.metadata.promptTokens).toBe(100);
      expect(result.metadata.completionTokens).toBe(50);
      expect(result.metadata.totalTokens).toBe(150);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockGenerateText.mockRejectedValue(new Error('API Error'));

      const agent = new Agent({
        name: 'Error Agent',
        instructions: 'Handle errors',
      });

      await expect(run(agent, 'This will fail')).rejects.toThrow('API Error');
    });

    it('should handle tool execution errors', async () => {
      const failingTool = tool({
        description: 'Failing tool',
        parameters: z.object({ input: z.string() }),
        execute: async () => {
          throw new Error('Tool failed');
        },
      });

      mockGenerateText.mockResolvedValue({
        text: 'Tool failed',
        toolCalls: [
          {
            toolCallId: 'call_789',
            toolName: 'failingTool',
            args: { input: 'test' },
          },
        ],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        steps: [],
      } as any);

      const agent = new Agent({
        name: 'Failing Agent',
        instructions: 'Use failing tool',
        tools: { failingTool },
      });

      // Should handle tool error gracefully
      const result = await run(agent, 'Test failing tool');
      expect(result).toBeDefined();
    });
  });
});
