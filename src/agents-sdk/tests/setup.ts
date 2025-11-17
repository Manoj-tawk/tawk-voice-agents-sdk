/**
 * Jest Test Setup
 * 
 * Global mocks and setup for all tests
 */

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-api-key';

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
};

// Mock Langfuse
jest.mock('../src/langfuse', () => ({
  initializeLangfuse: jest.fn(() => null),
  getLangfuse: jest.fn(() => null),
  isLangfuseEnabled: jest.fn(() => false),
  createTrace: jest.fn(() => ({ id: 'mock-trace' })),
  createGeneration: jest.fn(() => ({ id: 'mock-generation' })),
  updateGeneration: jest.fn(),
  endGeneration: jest.fn(),
  createSpan: jest.fn(() => ({ id: 'mock-span' })),
  endSpan: jest.fn(),
  score: jest.fn(),
  flushLangfuse: jest.fn(),
  shutdownLangfuse: jest.fn(),
  formatMessagesForLangfuse: jest.fn(() => []),
  extractModelName: jest.fn(() => 'test-model'),
}));

// Mock AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn(),
  streamText: jest.fn(),
  tool: jest.fn((config) => config),
}));

