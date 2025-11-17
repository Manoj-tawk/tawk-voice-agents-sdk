/**
 * Handoff System
 * 
 * Implements structured agent-to-agent handoffs for multi-agent workflows.
 * Handoffs allow one agent to delegate tasks to another specialized agent.
 * 
 * @module handoff
 */

import { Agent } from './agent';
import type { RunContextWrapper } from './agent';

/**
 * Data passed to handoff input filters
 */
export interface HandoffInputData {
  /**
   * The original input history
   */
  inputHistory: any[];
  
  /**
   * Items generated before the handoff
   */
  preHandoffItems: any[];
  
  /**
   * New items generated during this turn
   */
  newItems: any[];
  
  /**
   * The run context
   */
  runContext?: RunContextWrapper<any>;
}

/**
 * Function that filters inputs passed to the next agent
 */
export type HandoffInputFilter = (input: HandoffInputData) => HandoffInputData;

/**
 * Function that determines if handoff is enabled
 */
export type HandoffEnabledFunction<TContext = any> = (args: {
  runContext: RunContextWrapper<TContext>;
  agent: Agent<any, any>;
}) => Promise<boolean>;

/**
 * Handoff class - represents delegation from one agent to another
 */
export class Handoff<TContext = any, TOutput = string> {
  /**
   * Name of the tool that represents this handoff
   */
  public toolName: string;

  /**
   * Description of when to use this handoff
   */
  public toolDescription: string;

  /**
   * The agent being handed off to
   */
  public agent: Agent<TContext, TOutput>;

  /**
   * Name of the agent being handed off to
   */
  public agentName: string;

  /**
   * Function called when handoff is invoked
   */
  public onInvokeHandoff: (
    context: RunContextWrapper<TContext>,
    args: string,
  ) => Promise<Agent<TContext, TOutput>> | Agent<TContext, TOutput>;

  /**
   * Optional filter for inputs passed to next agent
   */
  public inputFilter?: HandoffInputFilter;

  /**
   * Function that determines if this handoff is enabled
   */
  public isEnabled: HandoffEnabledFunction<TContext>;

  constructor(
    agent: Agent<TContext, TOutput>,
    onInvokeHandoff: (
      context: RunContextWrapper<TContext>,
      args: string,
    ) => Promise<Agent<TContext, TOutput>> | Agent<TContext, TOutput>,
  ) {
    this.agent = agent;
    this.agentName = agent.name;
    this.onInvokeHandoff = onInvokeHandoff;
    
    // Default tool name: transfer_to_agent_name
    this.toolName = `transfer_to_${agent.name.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Default description
    this.toolDescription = `Handoff to the ${agent.name} agent to handle the request. ${
      (agent as any).handoffDescription ?? ''
    }`;
    
    // Default: always enabled
    this.isEnabled = async () => true;
  }

  /**
   * Get transfer message for tool output
   */
  getTransferMessage(): string {
    return JSON.stringify({ assistant: this.agentName });
  }
}

/**
 * Create a handoff from an agent
 */
export function handoff<TContext = any, TOutput = string>(
  agent: Agent<TContext, TOutput>,
  config: {
    toolNameOverride?: string;
    toolDescriptionOverride?: string;
    inputFilter?: HandoffInputFilter;
    isEnabled?: boolean | HandoffEnabledFunction<TContext>;
  } = {},
): Handoff<TContext, TOutput> {
  const handoffInstance = new Handoff(
    agent,
    async () => agent,
  );

  if (config.toolNameOverride) {
    handoffInstance.toolName = config.toolNameOverride;
  }

  if (config.toolDescriptionOverride) {
    handoffInstance.toolDescription = config.toolDescriptionOverride;
  }

  if (config.inputFilter) {
    handoffInstance.inputFilter = config.inputFilter;
  }

  if (typeof config.isEnabled === 'function') {
    handoffInstance.isEnabled = config.isEnabled;
  } else if (typeof config.isEnabled === 'boolean') {
    handoffInstance.isEnabled = async () => config.isEnabled as boolean;
  }

  return handoffInstance;
}

/**
 * Get handoff from agent or handoff instance
 */
export function getHandoff<TContext, TOutput>(
  agent: Agent<TContext, TOutput> | Handoff<TContext, TOutput>,
): Handoff<TContext, TOutput> {
  if (agent instanceof Handoff) {
    return agent;
  }
  return handoff(agent);
}

