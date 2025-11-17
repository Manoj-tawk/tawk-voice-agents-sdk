/**
 * Result Types - Enhanced RunResult
 * 
 * Provides rich result types with history, output, metadata, and more.
 * 
 * @module result
 */

import type { Agent } from './agent';
import type { RunState, RunItem, ModelResponse } from './runstate';
import type { CoreMessage } from 'ai';

/**
 * Enhanced RunResult with additional properties
 */
export class RunResult<TContext = any, TAgent extends Agent<TContext, any> = Agent<any, any>> {
  constructor(public readonly state: RunState<TContext>) {}

  /**
   * The history of the agent run.
   * Includes input items + new items generated during the run.
   * Can be used as input for the next agent run.
   */
  get history(): CoreMessage[] {
    return [
      ...(typeof this.state.originalInput === 'string' 
        ? [{ role: 'user' as const, content: this.state.originalInput }]
        : this.state.originalInput
      ),
      ...this.state.messages,
    ];
  }

  /**
   * The new items generated during the agent run.
   * These include messages, tool calls, tool outputs, etc.
   */
  get output(): CoreMessage[] {
    return this.state.messages;
  }

  /**
   * The original input items (before the run)
   */
  get input(): string | CoreMessage[] {
    return this.state.originalInput;
  }

  /**
   * All run items generated during the run
   */
  get newItems(): RunItem[] {
    return this.state.items;
  }

  /**
   * Raw model responses
   */
  get rawResponses(): ModelResponse[] {
    return this.state.modelResponses;
  }

  /**
   * The last response ID (if applicable)
   */
  get lastResponseId(): string | undefined {
    const responses = this.rawResponses;
    return responses && responses.length > 0
      ? (responses[responses.length - 1] as any).responseId
      : undefined;
  }

  /**
   * The last agent that ran
   */
  get lastAgent(): TAgent | undefined {
    return this.state.currentAgent as TAgent;
  }

  /**
   * The current agent (alias for lastAgent)
   */
  get currentAgent(): TAgent | undefined {
    return this.lastAgent;
  }

  /**
   * Input guardrail results
   */
  get inputGuardrailResults(): any[] {
    return (this.state as any).inputGuardrailResults || [];
  }

  /**
   * Output guardrail results
   */
  get outputGuardrailResults(): any[] {
    return (this.state as any).outputGuardrailResults || [];
  }

  /**
   * Interruptions that occurred (tool approvals, etc.)
   */
  get interruptions(): any[] {
    return (this.state as any).interruptions || [];
  }

  /**
   * Final output (already available in base result)
   */
  get finalOutput(): any {
    // This will be set by the caller
    return (this as any)._finalOutput;
  }

  set finalOutput(value: any) {
    (this as any)._finalOutput = value;
  }

  /**
   * Steps taken during the run
   */
  get steps(): any[] {
    return (this as any)._steps || [];
  }

  set steps(value: any[]) {
    (this as any)._steps = value;
  }

  /**
   * Metadata
   */
  get metadata(): any {
    return (this as any)._metadata || {};
  }

  set metadata(value: any) {
    (this as any)._metadata = value;
  }

  /**
   * Messages
   */
  get messages(): CoreMessage[] {
    return this.state.messages;
  }
}

/**
 * Streaming run result
 */
export class StreamedRunResult<TContext = any, TAgent extends Agent<TContext, any> = Agent<any, any>> 
  extends RunResult<TContext, TAgent> 
  implements AsyncIterable<any> {
  
  private _currentTurn: number = 0;
  private _maxTurns: number | undefined;
  private _cancelled: boolean = false;
  private _error: unknown = null;
  private _completed: Promise<void>;
  private _resolveCompleted?: () => void;
  private _rejectCompleted?: (err: unknown) => void;

  constructor(state: RunState<TContext>) {
    super(state);

    this._completed = new Promise((resolve, reject) => {
      this._resolveCompleted = resolve;
      this._rejectCompleted = reject;
    });
  }

  /**
   * Current turn number
   */
  get currentTurn(): number {
    return this._currentTurn;
  }

  set currentTurn(value: number) {
    this._currentTurn = value;
  }

  /**
   * Maximum turns
   */
  get maxTurns(): number | undefined {
    return this._maxTurns;
  }

  set maxTurns(value: number | undefined) {
    this._maxTurns = value;
  }

  /**
   * Whether the stream has been cancelled
   */
  get cancelled(): boolean {
    return this._cancelled;
  }

  /**
   * Cancel the stream
   */
  cancel(): void {
    this._cancelled = true;
  }

  /**
   * Promise that resolves when stream completes
   */
  get completed(): Promise<void> {
    return this._completed;
  }

  /**
   * Error that occurred during streaming
   */
  get error(): unknown {
    return this._error;
  }

  /**
   * Mark as done
   */
  _done(): void {
    this._resolveCompleted?.();
  }

  /**
   * Set error
   */
  _raiseError(err: unknown): void {
    this._error = err;
    this._rejectCompleted?.(err);
  }

  /**
   * Async iterator
   */
  async *[Symbol.asyncIterator](): AsyncIterator<any> {
    // Implementation would depend on streaming setup
    yield* [];
  }

  /**
   * Convert to text stream
   */
  toTextStream(): AsyncIterable<string> {
    // Implementation would filter for text chunks
    return {
      async *[Symbol.asyncIterator]() {
        yield* [];
      }
    };
  }
}

