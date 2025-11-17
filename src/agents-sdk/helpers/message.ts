/**
 * Message Helper Functions
 * 
 * Utilities for creating and manipulating messages across different AI providers.
 * 
 * @module helpers/message
 */

import type { CoreMessage } from 'ai';

/**
 * Create a user message
 */
export function user(content: string): CoreMessage {
  return {
    role: 'user',
    content,
  };
}

/**
 * Create an assistant message
 */
export function assistant(content: string): CoreMessage {
  return {
    role: 'assistant',
    content,
  };
}

/**
 * Create a system message
 */
export function system(content: string): CoreMessage {
  return {
    role: 'system',
    content,
  };
}

/**
 * Create a tool message
 * Note: Uses AI SDK's standard tool message structure
 */
export function toolMessage(content: string): CoreMessage {
  return {
    role: 'tool',
    content: [{ type: 'tool-result' as any, toolCallId: '', toolName: '', result: content }],
  };
}

/**
 * Get the last text content from messages
 */
export function getLastTextContent(messages: CoreMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant' && typeof msg.content === 'string') {
      return msg.content;
    }
  }
  return undefined;
}

/**
 * Filter messages by role
 */
export function filterMessagesByRole(
  messages: CoreMessage[],
  role: 'user' | 'assistant' | 'system' | 'tool'
): CoreMessage[] {
  return messages.filter(m => m.role === role);
}

/**
 * Extract all text from messages
 */
export function extractAllText(messages: CoreMessage[]): string {
  return messages
    .filter(m => typeof m.content === 'string')
    .map(m => m.content as string)
    .join('\n\n');
}

