/**
 * Handoff Extensions
 * 
 * Pre-built handoff filters and utilities for multi-agent workflows.
 * 
 * @module extensions/handoff
 */

import type { HandoffInputData } from '../handoff';

/**
 * Remove all tools from handoff input
 * Useful when you don't want the next agent to see previous tool calls
 */
export function removeAllTools(input: HandoffInputData): HandoffInputData {
  const filteredHistory = Array.isArray(input.inputHistory)
    ? input.inputHistory.filter((msg: any) => msg.role !== 'tool')
    : input.inputHistory;

  const filteredPreItems = input.preHandoffItems.filter(
    (item: any) => item.type !== 'tool_call' && item.type !== 'tool_result'
  );

  const filteredNewItems = input.newItems.filter(
    (item: any) => item.type !== 'tool_call' && item.type !== 'tool_result'
  );

  return {
    inputHistory: filteredHistory,
    preHandoffItems: filteredPreItems,
    newItems: filteredNewItems,
    runContext: input.runContext,
  };
}

/**
 * Keep only the last N messages
 */
export function keepLastMessages(limit: number): (input: HandoffInputData) => HandoffInputData {
  return (input: HandoffInputData) => {
    const historyArray = Array.isArray(input.inputHistory)
      ? input.inputHistory
      : [{ role: 'user' as const, content: input.inputHistory }];

    const kept = historyArray.slice(-limit);

    return {
      inputHistory: kept,
      preHandoffItems: input.preHandoffItems.slice(-limit),
      newItems: input.newItems.slice(-limit),
      runContext: input.runContext,
    };
  };
}

/**
 * Keep only the last message
 */
export function keepLastMessage(): (input: HandoffInputData) => HandoffInputData {
  return keepLastMessages(1);
}

/**
 * Keep only messages (remove all items)
 */
export function keepMessagesOnly(input: HandoffInputData): HandoffInputData {
  return {
    inputHistory: input.inputHistory,
    preHandoffItems: [],
    newItems: [],
    runContext: input.runContext,
  };
}

/**
 * Create a handoff prompt describing available handoffs
 */
export function createHandoffPrompt(agents: Array<{ name: string; handoffDescription?: string }>): string {
  if (agents.length === 0) {
    return '';
  }

  const descriptions = agents
    .map(agent => {
      const desc = agent.handoffDescription || 'No description available';
      return `- ${agent.name}: ${desc}`;
    })
    .join('\n');

  return `Available specialists to handoff to:\n${descriptions}`;
}

