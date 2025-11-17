/**
 * Events System
 * 
 * Streaming events for agent runs and lifecycle management.
 * 
 * @module events
 */

import type { Agent } from './agent';
import type { RunItem } from './runstate';

/**
 * Streaming event from the LLM (raw events passed through)
 */
export class RunRawModelStreamEvent {
  public readonly type = 'raw_model_stream_event';
  
  constructor(public data: any) {}
}

/**
 * Names of run item stream events
 */
export type RunItemStreamEventName =
  | 'message_output_created'
  | 'handoff_requested'
  | 'handoff_occurred'
  | 'tool_called'
  | 'tool_output'
  | 'reasoning_item_created';

/**
 * Streaming events that wrap a RunItem
 */
export class RunItemStreamEvent {
  public readonly type = 'run_item_stream_event';
  
  constructor(
    public name: RunItemStreamEventName,
    public item: RunItem,
  ) {}
}

/**
 * Event that notifies that there is a new agent running
 */
export class RunAgentUpdatedStreamEvent {
  public readonly type = 'agent_updated_stream_event';
  
  constructor(public agent: Agent<any, any>) {}
}

/**
 * Union of all streaming event types
 */
export type RunStreamEvent =
  | RunRawModelStreamEvent
  | RunItemStreamEvent
  | RunAgentUpdatedStreamEvent;

