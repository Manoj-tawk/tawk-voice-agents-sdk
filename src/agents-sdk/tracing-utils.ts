/**
 * Tracing Utilities
 * 
 * Wrapper functions for tracing tool execution and handoffs.
 * 
 * @module tracing-utils
 */

import { createSpan, endSpan } from './langfuse';

/**
 * Wrap a function execution with a tracing span
 */
export async function withFunctionSpan<T>(
  trace: any,
  name: string,
  input: any,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  if (!trace) {
    return await fn();
  }

  const span = createSpan(trace, {
    name: `Tool: ${name}`,
    input,
    metadata: {
      ...metadata,
      toolName: name,
      type: 'function',
    },
  });

  try {
    const result = await fn();
    
    if (span) {
      endSpan(span, {
        output: result,
        level: 'DEFAULT',
      });
    }
    
    return result;
  } catch (error) {
    if (span) {
      endSpan(span, {
        output: { error: error instanceof Error ? error.message : String(error) },
        level: 'ERROR',
        statusMessage: 'Tool execution failed',
      });
    }
    throw error;
  }
}

/**
 * Wrap a handoff with a tracing span
 */
export async function withHandoffSpan<T>(
  trace: any,
  fromAgent: string,
  toAgent: string,
  reason: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!trace) {
    return await fn();
  }

  const span = createSpan(trace, {
    name: `Handoff: ${fromAgent} → ${toAgent}`,
    input: {
      from: fromAgent,
      to: toAgent,
      reason,
    },
    metadata: {
      type: 'handoff',
      fromAgent,
      toAgent,
      handoffReason: reason,
    },
  });

  try {
    const result = await fn();
    
    if (span) {
      endSpan(span, {
        output: { success: true, result },
        level: 'DEFAULT',
      });
    }
    
    return result;
  } catch (error) {
    if (span) {
      endSpan(span, {
        output: { error: error instanceof Error ? error.message : String(error) },
        level: 'ERROR',
        statusMessage: 'Handoff failed',
      });
    }
    throw error;
  }
}

/**
 * Wrap a guardrail check with a tracing span
 */
export async function withGuardrailSpan<T>(
  trace: any,
  guardrailName: string,
  input: any,
  fn: () => Promise<T>
): Promise<T> {
  if (!trace) {
    return await fn();
  }

  const span = createSpan(trace, {
    name: `Guardrail: ${guardrailName}`,
    input,
    metadata: {
      type: 'guardrail',
      guardrailName,
    },
  });

  try {
    const result = await fn();
    
    if (span) {
      endSpan(span, {
        output: result,
        level: 'DEFAULT',
      });
    }
    
    return result;
  } catch (error) {
    if (span) {
      endSpan(span, {
        output: { error: error instanceof Error ? error.message : String(error) },
        level: 'ERROR',
        statusMessage: 'Guardrail failed',
      });
    }
    throw error;
  }
}

