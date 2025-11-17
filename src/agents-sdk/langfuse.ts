/**
 * Langfuse Tracing Integration for Tawk Agents SDK
 * 
 * @module langfuse
 * @author Tawk.to
 * @license MIT
 * 
 * Provides automatic tracing and observability for agent interactions
 * using Langfuse (https://langfuse.com)
 */

import { Langfuse } from 'langfuse';
import type { CoreMessage } from 'ai';

let langfuseInstance: Langfuse | null = null;
let isEnabled = false;

/**
 * Initialize Langfuse with credentials from environment variables
 */
export function initializeLangfuse(): Langfuse | null {
  // Check if already initialized
  if (langfuseInstance) {
    return langfuseInstance;
  }

  // Check for required environment variables
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    console.warn('⚠️  Langfuse not initialized: Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY');
    return null;
  }

  try {
    langfuseInstance = new Langfuse({
      publicKey,
      secretKey,
      baseUrl,
      flushAt: 1, // Flush immediately for testing
      requestTimeout: 10000,
    });

    isEnabled = true;
    console.log('✅ Langfuse tracing initialized:', baseUrl);
    return langfuseInstance;
  } catch (error) {
    console.error('❌ Failed to initialize Langfuse:', error);
    return null;
  }
}

/**
 * Get the current Langfuse instance (initializes if needed)
 */
export function getLangfuse(): Langfuse | null {
  if (!langfuseInstance) {
    return initializeLangfuse();
  }
  return langfuseInstance;
}

/**
 * Check if Langfuse tracing is enabled
 */
export function isLangfuseEnabled(): boolean {
  return isEnabled && langfuseInstance !== null;
}

/**
 * Create a trace for an agent run
 */
export function createTrace(options: {
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}) {
  const langfuse = getLangfuse();
  if (!langfuse) return null;

  try {
    const trace = langfuse.trace({
      name: options.name,
      userId: options.userId,
      sessionId: options.sessionId,
      metadata: options.metadata,
      tags: options.tags,
    });

    return trace;
  } catch (error) {
    console.error('Failed to create Langfuse trace:', error);
    return null;
  }
}

/**
 * Create a generation span within a trace
 */
export function createGeneration(trace: any, options: {
  name: string;
  model?: string;
  modelParameters?: Record<string, any>;
  input?: any;
  metadata?: Record<string, any>;
}) {
  if (!trace) return null;

  try {
    const generation = trace.generation({
      name: options.name,
      model: options.model,
      modelParameters: options.modelParameters,
      input: options.input,
      metadata: options.metadata,
    });

    return generation;
  } catch (error) {
    console.error('Failed to create Langfuse generation:', error);
    return null;
  }
}

/**
 * Update a generation with output and usage data
 */
export function updateGeneration(generation: any, options: {
  output?: any;
  usage?: {
    input?: number;
    output?: number;
    total?: number;
  };
  metadata?: Record<string, any>;
}) {
  if (!generation) return;

  try {
    generation.update({
      output: options.output,
      usage: options.usage,
      metadata: options.metadata,
    });
  } catch (error) {
    console.error('Failed to update Langfuse generation:', error);
  }
}

/**
 * End a generation with completion status
 */
export function endGeneration(generation: any, options?: {
  output?: any;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  statusMessage?: string;
}) {
  if (!generation) return;

  try {
    generation.end({
      output: options?.output,
      level: options?.level,
      statusMessage: options?.statusMessage,
    });
  } catch (error) {
    console.error('Failed to end Langfuse generation:', error);
  }
}

/**
 * Create a span for tool execution
 */
export function createSpan(trace: any, options: {
  name: string;
  input?: any;
  metadata?: Record<string, any>;
}) {
  if (!trace) return null;

  try {
    const span = trace.span({
      name: options.name,
      input: options.input,
      metadata: options.metadata,
    });

    return span;
  } catch (error) {
    console.error('Failed to create Langfuse span:', error);
    return null;
  }
}

/**
 * End a span with output data
 */
export function endSpan(span: any, options?: {
  output?: any;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  statusMessage?: string;
}) {
  if (!span) return;

  try {
    span.end({
      output: options?.output,
      level: options?.level,
      statusMessage: options?.statusMessage,
    });
  } catch (error) {
    console.error('Failed to end Langfuse span:', error);
  }
}

/**
 * Score a trace or generation
 */
export function score(options: {
  traceId?: string;
  observationId?: string;
  name: string;
  value: number;
  comment?: string;
}) {
  const langfuse = getLangfuse();
  if (!langfuse) return;

  try {
    langfuse.score({
      traceId: options.traceId,
      observationId: options.observationId,
      name: options.name,
      value: options.value,
      comment: options.comment,
    });
  } catch (error) {
    console.error('Failed to score Langfuse trace:', error);
  }
}

/**
 * Flush all pending traces to Langfuse
 */
export async function flushLangfuse(): Promise<void> {
  const langfuse = getLangfuse();
  if (!langfuse) return;

  try {
    await langfuse.flushAsync();
  } catch (error) {
    console.error('Failed to flush Langfuse:', error);
  }
}

/**
 * Shutdown Langfuse and flush all pending traces
 */
export async function shutdownLangfuse(): Promise<void> {
  const langfuse = getLangfuse();
  if (!langfuse) return;

  try {
    await langfuse.shutdownAsync();
    langfuseInstance = null;
    isEnabled = false;
    console.log('✅ Langfuse shutdown complete');
  } catch (error) {
    console.error('Failed to shutdown Langfuse:', error);
  }
}

/**
 * Helper to format messages for Langfuse
 */
export function formatMessagesForLangfuse(messages: CoreMessage[]): any[] {
  return messages.map(msg => ({
    role: msg.role,
    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
  }));
}

/**
 * Helper to extract model name from model config
 */
export function extractModelName(model: any): string {
  if (typeof model === 'string') return model;
  if (model?.modelId) return model.modelId;
  if (model?.provider && model?.model) return `${model.provider}/${model.model}`;
  return 'unknown';
}

