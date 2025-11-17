/**
 * Tawk Agents SDK - Core
 * 
 * Production-ready AI agent framework built on Vercel AI SDK.
 * Flexible, multi-provider support with comprehensive features.
 * 
 * @packageDocumentation
 * @module @tawk-agents-sdk/core
 * @author Tawk.to
 * @license MIT
 * @version 1.0.0
 */

// ============================================
// CORE EXPORTS
// ============================================

export {
  // Agent class
  Agent,
  
  // Run functions
  run,
  runStream,
  
  // Tool function
  tool,
  
  // Utilities
  setDefaultModel,
} from './agent';

// NEW: Race agents pattern
export { raceAgents } from './race-agents';

// Usage tracking
export { Usage } from './usage';

// Enhanced Result types (override agent.ts exports with richer versions)
export { RunResult as EnhancedRunResult, StreamedRunResult } from './result';

// Handoff system - DEPRECATED: Use transfers instead
// Keeping exports for backward compatibility but marked as deprecated
export { Handoff, handoff, getHandoff } from './handoff';
export type { HandoffInputData, HandoffInputFilter, HandoffEnabledFunction } from './handoff';

// Handoff extensions - DEPRECATED
export {
  removeAllTools,
  keepLastMessages,
  keepLastMessage,
  keepMessagesOnly,
  createHandoffPrompt,
} from './extensions/handoff-filters';

// Tracing utilities
export { withFunctionSpan, withHandoffSpan, withGuardrailSpan } from './tracing-utils';

// Tracing context
export { withTrace, getCurrentTrace, getCurrentSpan, setCurrentSpan, createContextualSpan, createContextualGeneration } from './tracing/context';

// ============================================
// EVENTS & LIFECYCLE
// ============================================

// Events
export {
  RunRawModelStreamEvent,
  RunItemStreamEvent,
  RunAgentUpdatedStreamEvent,
} from './events';
export type { RunItemStreamEventName, RunStreamEvent } from './events';

// Lifecycle hooks
export { AgentHooks, RunHooks } from './lifecycle';
export type { AgentHookEvents, RunHookEvents } from './lifecycle';

// Utilities
export { safeExecute, safeExecuteWithTimeout } from './utils/safe-execute';
export type { SafeExecuteResult } from './utils/safe-execute';

// Message helpers
export { user, assistant, system, toolMessage, getLastTextContent, filterMessagesByRole, extractAllText } from './helpers/message';

// Type utilities
export type {
  Expand,
  DeepPartial,
  SnakeToCamelCase,
  RequireKeys,
  OptionalKeys,
  KeysOfType,
  Prettify,
  Mutable,
  UnwrapPromise,
  ArrayElement,
} from './types/helpers';

// Run state management
export { RunState } from './runstate';
export type {
  RunItem,
  RunItemType,
  RunMessageItem,
  RunToolCallItem,
  RunToolResultItem,
  RunHandoffCallItem,
  RunHandoffOutputItem,
  RunGuardrailItem,
  ModelResponse,
} from './runstate';

// Types from agent
export type {
  AgentConfig,
  AgentMetric,
  RunOptions,
  RunResult,
  StreamResult,
  Session,
  StepResult,
  RunContextWrapper,
} from './agent';

// ============================================
// SESSION MANAGEMENT
// ============================================

export {
  SessionManager,
} from './session';

// ============================================
// GUARDRAILS
// ============================================

export {
  guardrails,
  piiDetectionGuardrail,
  lengthGuardrail,
  contentSafetyGuardrail,
  topicRelevanceGuardrail,
  formatValidationGuardrail,
  customGuardrail,
  rateLimitGuardrail,
  languageGuardrail,
  sentimentGuardrail,
  toxicityGuardrail,
} from './guardrails';

export type {
  Guardrail,
  GuardrailResult,
} from './agent';

// ============================================
// MCP (Model Context Protocol)
// ============================================

export {
  MCPServerManager,
  getGlobalMCPManager,
  registerMCPServer,
  getMCPTools,
  shutdownMCPServers,
} from './mcp';

// MCP utilities
export {
  filterMCPTools,
  createMCPToolStaticFilter,
  mcpToFunctionTool,
  normalizeMCPToolName,
  groupMCPToolsByServer,
} from './mcp-utils';
export type { MCPToolFilter } from './mcp-utils';

// ============================================
// HUMAN-IN-THE-LOOP (Approvals)
// ============================================

export {
  ApprovalManager,
  getGlobalApprovalManager,
  createCLIApprovalHandler,
  createWebhookApprovalHandler,
  createAutoApproveHandler,
  createAutoRejectHandler,
} from './approvals';

// ============================================
// TRACING
// ============================================

export {
  TraceManager,
  getGlobalTraceManager,
  setGlobalTraceCallback,
  createLangfuseCallback,
  createConsoleCallback,
} from './tracing';

export type {
  Trace,
} from './tracing';

// ============================================
// LANGFUSE INTEGRATION
// ============================================

export {
  initializeLangfuse,
  getLangfuse,
  isLangfuseEnabled,
  createTrace,
  createGeneration,
  updateGeneration,
  endGeneration,
  createSpan,
  endSpan,
  score,
  flushLangfuse,
  shutdownLangfuse,
} from './langfuse';

// ============================================
// ERROR TYPES
// ============================================

export {
  MaxTurnsExceededError,
  GuardrailTripwireTriggered,
  ToolExecutionError,
  HandoffError,
  ApprovalRequiredError,
  backgroundResult,
  isBackgroundResult,
} from './types';

export type {
  BackgroundResult,
} from './types';

/**
 * Package version
 */
export const VERSION = '1.0.0';

/**
 * Default export for convenience
 */
export { Agent as default } from './agent';
