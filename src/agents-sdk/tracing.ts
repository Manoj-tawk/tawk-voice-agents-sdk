/**
 * Tracing Support for Langfuse Integration
 * 
 * Provides hooks and helpers for integrating with Langfuse or other observability tools
 */

import type { TraceEvent, TraceCallback, TraceOptions, StepResult, RunMetadata } from './types';
import { randomBytes } from 'crypto';

// ============================================
// TRACE MANAGER
// ============================================

export class TraceManager {
  private activeTraces = new Map<string, Trace>();
  private globalCallback?: TraceCallback;

  /**
   * Set a global trace callback
   */
  setGlobalCallback(callback: TraceCallback): void {
    this.globalCallback = callback;
  }

  /**
   * Start a new trace
   */
  startTrace(options: TraceOptions = {}): Trace {
    const traceId = options.traceId || this.generateTraceId();
    const trace = new Trace(traceId, options, this.globalCallback);
    this.activeTraces.set(traceId, trace);
    return trace;
  }

  /**
   * Get an active trace
   */
  getTrace(traceId: string): Trace | undefined {
    return this.activeTraces.get(traceId);
  }

  /**
   * End a trace
   */
  endTrace(traceId: string): void {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.end();
      this.activeTraces.delete(traceId);
    }
  }

  /**
   * Clear all traces
   */
  clearAll(): void {
    for (const trace of this.activeTraces.values()) {
      trace.end();
    }
    this.activeTraces.clear();
  }

  private generateTraceId(): string {
    return `trace_${randomBytes(16).toString('hex')}`;
  }
}

// ============================================
// TRACE CLASS
// ============================================

export class Trace {
  private events: TraceEvent[] = [];
  private startTime: number;
  private endTime?: number;
  private callback?: TraceCallback;

  constructor(
    public readonly id: string,
    public readonly options: TraceOptions,
    callback?: TraceCallback
  ) {
    this.startTime = Date.now();
    this.callback = callback || options.metadata?.callback;
    
    this.emit({
      type: 'agent-start',
      timestamp: this.startTime,
      data: {
        traceId: id,
        ...options,
      },
    });
  }

  /**
   * Log an agent step start
   */
  agentStepStart(agentName: string, stepNumber: number, messages: any[]): void {
    this.emit({
      type: 'agent-start',
      timestamp: Date.now(),
      data: {
        agentName,
        stepNumber,
        messageCount: messages.length,
      },
    });
  }

  /**
   * Log an agent step end
   */
  agentStepEnd(step: StepResult): void {
    this.emit({
      type: 'agent-end',
      timestamp: Date.now(),
      data: step,
    });
  }

  /**
   * Log a tool execution start
   */
  toolStart(toolName: string, args: any): void {
    this.emit({
      type: 'tool-start',
      timestamp: Date.now(),
      data: {
        toolName,
        args,
      },
    });
  }

  /**
   * Log a tool execution end
   */
  toolEnd(toolName: string, result: any, duration?: number): void {
    this.emit({
      type: 'tool-end',
      timestamp: Date.now(),
      data: {
        toolName,
        result,
        duration,
      },
    });
  }

  /**
   * Log a handoff
   */
  handoff(fromAgent: string, toAgent: string, reason?: string): void {
    this.emit({
      type: 'handoff',
      timestamp: Date.now(),
      data: {
        fromAgent,
        toAgent,
        reason,
      },
    });
  }

  /**
   * Log an error
   */
  error(error: Error, context?: any): void {
    this.emit({
      type: 'error',
      timestamp: Date.now(),
      data: {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        context,
      },
    });
  }

  /**
   * Log a guardrail check
   */
  guardrail(name: string, passed: boolean, message?: string): void {
    this.emit({
      type: 'guardrail',
      timestamp: Date.now(),
      data: {
        name,
        passed,
        message,
      },
    });
  }

  /**
   * End the trace
   */
  end(metadata?: RunMetadata): void {
    this.endTime = Date.now();
    
    this.emit({
      type: 'agent-end',
      timestamp: this.endTime,
      data: {
        traceId: this.id,
        duration: this.endTime - this.startTime,
        metadata,
        totalEvents: this.events.length,
      },
    });
  }

  /**
   * Get all events
   */
  getEvents(): TraceEvent[] {
    return [...this.events];
  }

  /**
   * Get trace summary
   */
  getSummary(): {
    id: string;
    duration: number;
    eventCount: number;
    toolCalls: number;
    handoffs: number;
    errors: number;
  } {
    const duration = (this.endTime || Date.now()) - this.startTime;
    const toolCalls = this.events.filter(e => e.type === 'tool-start').length;
    const handoffs = this.events.filter(e => e.type === 'handoff').length;
    const errors = this.events.filter(e => e.type === 'error').length;

    return {
      id: this.id,
      duration,
      eventCount: this.events.length,
      toolCalls,
      handoffs,
      errors,
    };
  }

  private emit(event: TraceEvent): void {
    this.events.push(event);
    
    if (this.callback) {
      try {
        this.callback(event);
      } catch (error) {
        console.error('Trace callback error:', error);
      }
    }
  }
}

// ============================================
// LANGFUSE HELPER
// ============================================

/**
 * Create a Langfuse trace callback
 * 
 * Example usage:
 * ```typescript
 * import { Langfuse } from 'langfuse';
 * 
 * const langfuse = new Langfuse({
 *   publicKey: process.env.LANGFUSE_PUBLIC_KEY,
 *   secretKey: process.env.LANGFUSE_SECRET_KEY,
 * });
 * 
 * const callback = createLangfuseCallback(langfuse);
 * ```
 */
export function createLangfuseCallback(langfuse: any): TraceCallback {
  return async (event: TraceEvent) => {
    try {
      if (event.type === 'agent-start' && event.data.traceId) {
        // Start a new trace
        langfuse.trace({
          id: event.data.traceId,
          name: 'agent-run',
          userId: event.data.userId,
          sessionId: event.data.sessionId,
          metadata: event.data.metadata,
          tags: event.data.tags,
        });
      } else if (event.type === 'tool-start') {
        // Log tool execution
        langfuse.span({
          name: `tool:${event.data.toolName}`,
          input: event.data.args,
          startTime: new Date(event.timestamp),
        });
      } else if (event.type === 'tool-end') {
        // End tool execution
        langfuse.span({
          name: `tool:${event.data.toolName}`,
          output: event.data.result,
          endTime: new Date(event.timestamp),
        });
      } else if (event.type === 'error') {
        // Log error
        langfuse.event({
          name: 'error',
          metadata: event.data,
          level: 'ERROR',
        });
      }
    } catch (error) {
      console.error('Langfuse callback error:', error);
    }
  };
}

/**
 * Create a simple console trace callback (for debugging)
 */
export function createConsoleCallback(verbose: boolean = false): TraceCallback {
  return (event: TraceEvent) => {
    const timestamp = new Date(event.timestamp).toISOString();
    
    if (verbose) {
      console.log(`[${timestamp}] ${event.type}:`, JSON.stringify(event.data, null, 2));
    } else {
      let summary = '';
      switch (event.type) {
        case 'agent-start':
          summary = `Agent: ${event.data.agentName}`;
          break;
        case 'tool-start':
          summary = `Tool: ${event.data.toolName}`;
          break;
        case 'handoff':
          summary = `${event.data.fromAgent} → ${event.data.toAgent}`;
          break;
        case 'error':
          summary = event.data.error?.message || 'Unknown error';
          break;
        default:
          summary = '';
      }
      console.log(`[${timestamp}] ${event.type}: ${summary}`);
    }
  };
}

// ============================================
// GLOBAL TRACE MANAGER
// ============================================

let globalTraceManager: TraceManager | null = null;

export function getGlobalTraceManager(): TraceManager {
  if (!globalTraceManager) {
    globalTraceManager = new TraceManager();
  }
  return globalTraceManager;
}

export function setGlobalTraceCallback(callback: TraceCallback): void {
  getGlobalTraceManager().setGlobalCallback(callback);
}

