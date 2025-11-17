/**
 * Conversation manager for handling chat history and context
 */

import { Message } from '../types';

export class ConversationManager {
  private history: Message[] = [];
  private systemPrompt?: string;
  private maxMessages: number;

  constructor(config: { systemPrompt?: string; maxMessages?: number } = {}) {
    this.systemPrompt = config.systemPrompt;
    this.maxMessages = config.maxMessages || 20;
  }

  /**
   * Add a message to the conversation history
   */
  addMessage(message: Message): void {
    this.history.push(message);

    // Trim history if too long
    if (this.history.length > this.maxMessages) {
      // Keep system prompt and remove oldest user/assistant messages
      const systemMessages = this.history.filter((m) => m.role === 'system');
      const otherMessages = this.history.filter((m) => m.role !== 'system');
      this.history = [
        ...systemMessages,
        ...otherMessages.slice(-this.maxMessages + systemMessages.length),
      ];
    }
  }

  /**
   * Get the full conversation history including system prompt
   */
  getHistory(): Message[] {
    const messages: Message[] = [];

    if (this.systemPrompt) {
      messages.push({
        role: 'system',
        content: this.systemPrompt,
      });
    }

    return [...messages, ...this.history];
  }

  /**
   * Set or update the system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Clear all conversation history
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Get the number of messages in history
   */
  getMessageCount(): number {
    return this.history.length;
  }

  /**
   * Get the last message in the conversation
   */
  getLastMessage(): Message | undefined {
    return this.history[this.history.length - 1];
  }

  /**
   * Get messages by role
   */
  getMessagesByRole(role: Message['role']): Message[] {
    return this.history.filter((m) => m.role === role);
  }

  /**
   * Get conversation summary for logging/debugging
   */
  getSummary(): string {
    const userMessages = this.getMessagesByRole('user').length;
    const assistantMessages = this.getMessagesByRole('assistant').length;
    const toolMessages = this.getMessagesByRole('tool').length;

    return `Total: ${this.history.length} messages (${userMessages} user, ${assistantMessages} assistant, ${toolMessages} tool)`;
  }
}

