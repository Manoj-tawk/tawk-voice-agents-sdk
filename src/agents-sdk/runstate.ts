/**
 * Run State Management
 * 
 * Manages the state of an agent run, including current agent,
 * turn count, messages, and generated items.
 * 
 * @module runstate
 */

import type { CoreMessage } from 'ai';
import type { Agent } from './agent';
import type { Usage } from './usage';

/**
 * Types of items that can be generated during a run
 */
export type RunItemType = 
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'handoff_call'
  | 'handoff_result'
  | 'guardrail_check';

/**
 * Base run item
 */
export interface RunItem {
  id: string;
  type: RunItemType;
  timestamp: number;
  agentName: string;
  metadata?: Record<string, any>;
}

/**
 * Message item
 */
export interface RunMessageItem extends RunItem {
  type: 'message';
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Tool call item
 */
export interface RunToolCallItem extends RunItem {
  type: 'tool_call';
  toolName: string;
  args: any;
}

/**
 * Tool result item
 */
export interface RunToolResultItem extends RunItem {
  type: 'tool_result';
  toolCallId: string;
  toolName: string;
  result: any;
  error?: string;
}

/**
 * Handoff call item
 */
export interface RunHandoffCallItem extends RunItem {
  type: 'handoff_call';
  fromAgent: string;
  toAgent: string;
  reason: string;
}

/**
 * Handoff result item
 */
export interface RunHandoffOutputItem extends RunItem {
  type: 'handoff_result';
  fromAgent: string;
  toAgent: string;
  success: boolean;
}

/**
 * Guardrail check item
 */
export interface RunGuardrailItem extends RunItem {
  type: 'guardrail_check';
  guardrailName: string;
  passed: boolean;
  message?: string;
}

/**
 * Model response tracking
 */
export interface ModelResponse {
  agentName: string;
  stepNumber: number;
  text: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls: Array<{
    toolName: string;
    args: any;
  }>;
}

/**
 * RunState manages the state of an agent run
 */
export class RunState<TContext = any> {
  /**
   * The run context (user-defined state)
   */
  public context: TContext;

  /**
   * Current agent handling the run
   */
  public currentAgent: Agent<any, any>;

  /**
   * Current turn number
   */
  public currentTurn: number;

  /**
   * Maximum turns allowed
   */
  public maxTurns: number;

  /**
   * Original input to the run
   */
  public originalInput: string | CoreMessage[];

  /**
   * All items generated during the run
   */
  public items: RunItem[];

  /**
   * All model responses
   */
  public modelResponses: ModelResponse[];

  /**
   * Current messages
   */
  public messages: CoreMessage[];

  /**
   * Aggregated usage across all agents
   */
  public usage: Usage;

  /**
   * Chain of agents involved (for multi-agent runs)
   */
  public handoffChain: string[];

  /**
   * Per-agent metrics
   */
  public agentMetrics: Map<string, {
    agentName: string;
    turns: number;
    tokens: { input: number; output: number; total: number };
    toolCalls: number;
  }>;

  constructor(
    initialAgent: Agent<any, any>,
    input: string | CoreMessage[],
    context: TContext,
    maxTurns: number = 50
  ) {
    this.currentAgent = initialAgent;
    this.originalInput = input;
    this.context = context;
    this.maxTurns = maxTurns;
    this.currentTurn = 0;
    this.items = [];
    this.modelResponses = [];
    this.messages = [];
    this.usage = new (require('./usage').Usage)();
    this.handoffChain = [initialAgent.name];
    this.agentMetrics = new Map();
  }

  /**
   * Add an item to the run
   */
  addItem(item: RunItem): void {
    this.items.push(item);
  }

  /**
   * Add a model response
   */
  addModelResponse(response: ModelResponse): void {
    this.modelResponses.push(response);
  }

  /**
   * Add a message
   */
  addMessage(message: CoreMessage): void {
    this.messages.push(message);
  }

  /**
   * Update usage
   */
  updateUsage(newUsage: Usage): void {
    this.usage.add(newUsage);
  }

  /**
   * Switch to a new agent (handoff)
   */
  handoffToAgent(newAgent: Agent<any, any>): void {
    this.currentAgent = newAgent;
    if (!this.handoffChain.includes(newAgent.name)) {
      this.handoffChain.push(newAgent.name);
    }
  }

  /**
   * Increment turn counter
   */
  incrementTurn(): void {
    this.currentTurn++;
  }

  /**
   * Check if max turns exceeded
   */
  isMaxTurnsExceeded(): boolean {
    return this.currentTurn >= this.maxTurns;
  }

  /**
   * Get summary of the run
   */
  getSummary() {
    return {
      turns: this.currentTurn,
      maxTurns: this.maxTurns,
      agentsInvolved: this.handoffChain,
      totalItems: this.items.length,
      totalMessages: this.messages.length,
      usage: this.usage.toJSON(),
      currentAgent: this.currentAgent.name,
    };
  }

  /**
   * Serialize state for resuming
   */
  toJSON() {
    return {
      currentAgent: this.currentAgent.name,
      currentTurn: this.currentTurn,
      maxTurns: this.maxTurns,
      originalInput: this.originalInput,
      items: this.items,
      modelResponses: this.modelResponses,
      messages: this.messages,
      usage: this.usage.toJSON(),
      handoffChain: this.handoffChain,
      agentMetrics: Array.from(this.agentMetrics.entries()),
    };
  }
}

