/**
 * Lifecycle Hooks and Event Emitters
 * 
 * Provides event emitters for agent and run lifecycle events.
 * 
 * @module lifecycle
 */

import { EventEmitter } from 'events';
import type { Agent } from './agent';
import type { RunContextWrapper } from './agent';

/**
 * Events that can be emitted by an Agent
 */
export interface AgentHookEvents<TContext = any, TOutput = string> {
  /**
   * Emitted when agent starts
   */
  agent_start: [context: RunContextWrapper<TContext>, agent: Agent<TContext, TOutput>];
  
  /**
   * Emitted when agent ends
   */
  agent_end: [context: RunContextWrapper<TContext>, output: TOutput];
  
  /**
   * Emitted when agent hands off to another agent
   */
  agent_handoff: [context: RunContextWrapper<TContext>, nextAgent: Agent<any, any>];
  
  /**
   * Emitted when agent starts executing a tool
   */
  agent_tool_start: [
    context: RunContextWrapper<TContext>,
    tool: { name: string; args: any },
  ];
  
  /**
   * Emitted when agent finishes executing a tool
   */
  agent_tool_end: [
    context: RunContextWrapper<TContext>,
    tool: { name: string; args: any },
    result: any,
  ];
}

/**
 * Events that can be emitted by a Runner
 */
export interface RunHookEvents<TContext = any, TOutput = string> {
  /**
   * Emitted when any agent starts in the run
   */
  agent_start: [context: RunContextWrapper<TContext>, agent: Agent<TContext, TOutput>];
  
  /**
   * Emitted when any agent ends in the run
   */
  agent_end: [
    context: RunContextWrapper<TContext>,
    agent: Agent<TContext, TOutput>,
    output: TOutput,
  ];
  
  /**
   * Emitted when an agent handoff occurs
   */
  agent_handoff: [
    context: RunContextWrapper<TContext>,
    fromAgent: Agent<any, any>,
    toAgent: Agent<any, any>,
  ];
  
  /**
   * Emitted when any tool starts
   */
  agent_tool_start: [
    context: RunContextWrapper<TContext>,
    agent: Agent<TContext, TOutput>,
    tool: { name: string; args: any },
  ];
  
  /**
   * Emitted when any tool ends
   */
  agent_tool_end: [
    context: RunContextWrapper<TContext>,
    agent: Agent<TContext, TOutput>,
    tool: { name: string; args: any },
    result: any,
  ];
}

/**
 * Agent hooks - event emitter for agent lifecycle
 */
export class AgentHooks<TContext = any, TOutput = string> extends EventEmitter {
  /**
   * Register a handler for agent_start event
   */
  onStart(handler: (...args: AgentHookEvents<TContext, TOutput>['agent_start']) => void): this {
    return this.on('agent_start', handler);
  }

  /**
   * Register a handler for agent_end event
   */
  onEnd(handler: (...args: AgentHookEvents<TContext, TOutput>['agent_end']) => void): this {
    return this.on('agent_end', handler);
  }

  /**
   * Register a handler for agent_handoff event
   */
  onHandoff(handler: (...args: AgentHookEvents<TContext, TOutput>['agent_handoff']) => void): this {
    return this.on('agent_handoff', handler);
  }

  /**
   * Register a handler for agent_tool_start event
   */
  onToolStart(handler: (...args: AgentHookEvents<TContext, TOutput>['agent_tool_start']) => void): this {
    return this.on('agent_tool_start', handler);
  }

  /**
   * Register a handler for agent_tool_end event
   */
  onToolEnd(handler: (...args: AgentHookEvents<TContext, TOutput>['agent_tool_end']) => void): this {
    return this.on('agent_tool_end', handler);
  }
}

/**
 * Run hooks - event emitter for run lifecycle
 */
export class RunHooks<TContext = any, TOutput = string> extends EventEmitter {
  /**
   * Register a handler for agent_start event
   */
  onAgentStart(handler: (...args: RunHookEvents<TContext, TOutput>['agent_start']) => void): this {
    return this.on('agent_start', handler);
  }

  /**
   * Register a handler for agent_end event
   */
  onAgentEnd(handler: (...args: RunHookEvents<TContext, TOutput>['agent_end']) => void): this {
    return this.on('agent_end', handler);
  }

  /**
   * Register a handler for agent_handoff event
   */
  onAgentHandoff(handler: (...args: RunHookEvents<TContext, TOutput>['agent_handoff']) => void): this {
    return this.on('agent_handoff', handler);
  }

  /**
   * Register a handler for agent_tool_start event
   */
  onToolStart(handler: (...args: RunHookEvents<TContext, TOutput>['agent_tool_start']) => void): this {
    return this.on('agent_tool_start', handler);
  }

  /**
   * Register a handler for agent_tool_end event
   */
  onToolEnd(handler: (...args: RunHookEvents<TContext, TOutput>['agent_tool_end']) => void): this {
    return this.on('agent_tool_end', handler);
  }
}

