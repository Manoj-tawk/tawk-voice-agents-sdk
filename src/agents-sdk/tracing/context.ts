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

  // Create new trace
  const trace = createTrace({
    name,
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
  return await traceStorage.run({ trace, span: null }, async () => {
    return await fn(trace);
  });
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

