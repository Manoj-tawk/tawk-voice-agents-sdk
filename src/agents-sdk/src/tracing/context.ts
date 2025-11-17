/**
 * Tracing Context Management
 * 
 * Context management for hierarchical tracing using AsyncLocalStorage.
 * Enables automatic trace propagation across async boundaries.
 * 
 * @module tracing/context
 */

import { AsyncLocalStorage } from 'async_hooks';

type TraceContext = {
  trace: any;  // Langfuse trace
  span: any;   // Current span
};

const traceStorage = new AsyncLocalStorage<TraceContext>();

/**
 * Get the current trace from context
 */
export function getCurrentTrace(): any | null {
  const context = traceStorage.getStore();
  return context?.trace || null;
}

/**
 * Get the current span from context
 */
export function getCurrentSpan(): any | null {
  const context = traceStorage.getStore();
  return context?.span || null;
}

/**
 * Set the current span in context
 */
export function setCurrentSpan(span: any): void {
  const context = traceStorage.getStore();
  if (context) {
    context.span = span;
  }
}

/**
 * Wrap code in a trace context
 * 
 * This is the KEY function - it creates ONE trace for the entire workflow
 */
export async function withTrace<T>(
  name: string,
  fn: (trace: any) => Promise<T>,
  options: {
    input?: any; // NEW: Accept input for trace
    metadata?: Record<string, any>;
    tags?: string[];
    sessionId?: string;
    userId?: string;
  } = {}
): Promise<T> {
  // Check if we already have a trace (nested call)
  const existingTrace = getCurrentTrace();
  if (existingTrace) {
    // Already in a trace, just execute
    return await fn(existingTrace);
  }

  // Import here to avoid circular dependency
  const { createTrace } = await import('../langfuse');

  // Create new trace with input
  const trace = createTrace({
    name,
    input: options.input, // NEW: Forward input to trace
    metadata: options.metadata,
    tags: options.tags,
    sessionId: options.sessionId,
    userId: options.userId,
  });

  if (!trace) {
    // Langfuse not enabled, just execute without tracing
    return await fn(null);
  }

  // Run function with trace in context
  // Capture output when function completes
  let result: T;
  let output: any = null;
  
  try {
    result = await traceStorage.run({ trace, span: null }, async () => {
      return await fn(trace);
    });
    
    // Extract output from result if it's a RunResult
    if (result && typeof result === 'object' && 'finalOutput' in result) {
      output = {
        finalOutput: (result as any).finalOutput,
        stepCount: (result as any).steps?.length || 0,
        totalToolCalls: (result as any).metadata?.totalToolCalls || 0,
        totalTransfers: (result as any).metadata?.totalTransfers || 0,
        handoffChain: (result as any).metadata?.handoffChain,
        finishReason: (result as any).metadata?.finishReason,
      };
    } else {
      output = result;
    }
    
    return result;
  } finally {
    // CRITICAL: Always update trace with output when function completes
    if (trace && output !== null) {
      try {
        trace.update({
          output,
          metadata: {
            ...options.metadata,
            completed: true,
          },
        });
      } catch (error) {
        // Don't fail if trace update fails
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to update trace output in withTrace:', error);
        }
      }
    }
  }
}

/**
 * Create a span in the current context
 * 
 * Automatically nests under current span or trace
 */
export function createContextualSpan(
  name: string,
  options: {
    metadata?: Record<string, any>;
    input?: any;
  } = {}
): any {
  const context = traceStorage.getStore();
  if (!context) {
    return null;
  }

  // Create span under current span or trace
  const parent = context.span || context.trace;
  if (!parent) {
    return null;
  }

  const span = parent.span({
    name,
    metadata: options.metadata,
    input: options.input,
  });

  return span;
}

/**
 * Create a generation in the current context
 * 
 * Automatically nests under current span or trace
 */
export function createContextualGeneration(
  name: string,
  options: {
    model?: string;
    input?: any;
    metadata?: Record<string, any>;
  } = {}
): any {
  const context = traceStorage.getStore();
  if (!context) {
    return null;
  }

  // Create generation under current span or trace
  const parent = context.span || context.trace;
  if (!parent) {
    return null;
  }

  const generation = parent.generation({
    name,
    model: options.model,
    input: options.input,
    metadata: options.metadata,
  });

  return generation;
}

