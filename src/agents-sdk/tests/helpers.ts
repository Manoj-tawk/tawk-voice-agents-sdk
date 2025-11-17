/**
 * Test Utilities and Helpers
 * 
 * Common mocks and utilities for unit tests
 */

import { generateText, streamText } from 'ai';

export const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
export const mockStreamText = streamText as jest.MockedFunction<typeof streamText>;

/**
 * Create a mock text response
 */
export function mockTextResponse(text: string, tokens = { prompt: 10, completion: 10 }) {
  return {
    text,
    usage: {
      promptTokens: tokens.prompt,
      completionTokens: tokens.completion,
      totalTokens: tokens.prompt + tokens.completion,
    },
    finishReason: 'stop' as const,
    steps: [],
  };
}

/**
 * Create a mock tool call response
 */
export function mockToolCallResponse(
  text: string,
  toolCalls: Array<{ name: string; args: any; result: any }>,
  tokens = { prompt: 20, completion: 15 }
) {
  return {
    text,
    toolCalls: toolCalls.map((tc, i) => ({
      toolCallId: `call_${i}`,
      toolName: tc.name,
      args: tc.args,
    })),
    toolResults: toolCalls.map((tc, i) => ({
      toolCallId: `call_${i}`,
      toolName: tc.name,
      result: tc.result,
    })),
    usage: {
      promptTokens: tokens.prompt,
      completionTokens: tokens.completion,
      totalTokens: tokens.prompt + tokens.completion,
    },
    finishReason: 'stop' as const,
    steps: [],
  };
}

/**
 * Create a mock model
 */
export function createMockModel(modelId = 'test-model') {
  return {
    modelId,
    provider: 'test',
    doGenerate: jest.fn(),
    doStream: jest.fn(),
  } as any;
}

/**
 * Create a mock stream
 */
export function createMockStream(chunks: string[]) {
  return {
    textStream: (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })(),
    fullStream: (async function* () {
      for (const chunk of chunks) {
        yield { type: 'text-delta', textDelta: chunk };
      }
    })(),
    completed: Promise.resolve(mockTextResponse(chunks.join(''))),
  };
}

/**
 * Wait for async operations
 */
export function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock console for clean test output
 */
export function mockConsole() {
  const original = { ...console };
  
  beforeEach(() => {
    global.console = {
      ...console,
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };
  });

  afterEach(() => {
    global.console = original;
  });
}

