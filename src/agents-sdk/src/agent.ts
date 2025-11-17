/**
 * Core Agent Implementation
 * 
 * @module agent
 * @description
 * Provides the core Agent class and runner functions that power the Tawk Agents SDK.
 * Built on top of Vercel AI SDK for maximum flexibility and provider support.
 * 
 * Features:
 * - Agents with instructions, tools, and handoffs
 * - Context management (dependency injection)
 * - Automatic conversation history (Sessions)
 * - Guardrails (input/output validation)
 * - Streaming support
 * - Multi-provider support (OpenAI, Anthropic, Google, Mistral, etc.)
 * - Comprehensive error handling
 * - Production-ready patterns
 * 
 * @author Tawk.to
 * @license MIT
 */

import { generateText, streamText, type CoreMessage, type LanguageModel } from 'ai';
import type { CoreTool } from 'ai';
import { z } from 'zod';
import { Usage } from './usage';
import {
  createTrace,
  formatMessagesForLangfuse,
  extractModelName,
  isLangfuseEnabled,
} from './langfuse';
import {
  getCurrentTrace,
  getCurrentSpan,
  setCurrentSpan,
} from './tracing/context';
import { AgentHooks, RunHooks } from './lifecycle';

// ============================================
// TYPES
// ============================================

export interface AgentConfig<TContext = any, TOutput = string> {
  name: string;
  instructions: string | ((context: RunContextWrapper<TContext>) => string | Promise<string>);
  model?: LanguageModel;
  tools?: Record<string, CoreTool>;
  handoffs?: Agent<TContext, any>[];
  handoffDescription?: string;  // NEW: Description for LLM to know when to handoff to this agent
  guardrails?: Guardrail<TContext>[];
  outputSchema?: z.ZodSchema<TOutput>;
  outputType?: z.ZodSchema<TOutput>;  // Alias for outputSchema
  maxSteps?: number;
  modelSettings?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
  };
  onStepFinish?: (step: StepResult) => void | Promise<void>;
  shouldFinish?: (context: TContext, toolResults: any[]) => boolean;
}

export interface RunOptions<TContext = any> {
  context?: TContext;
  session?: Session<TContext>;
  stream?: boolean;
  sessionInputCallback?: (history: CoreMessage[], newInput: CoreMessage[]) => CoreMessage[];
  maxTurns?: number;
}

export interface RunResult<TOutput = string> {
  finalOutput: TOutput;
  messages: CoreMessage[];
  steps: StepResult[];
  state?: RunState;
  metadata: {
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    finishReason?: string;
    totalToolCalls?: number;  // NEW: Total tool calls in entire run
    handoffChain?: string[];  // NEW: Chain of agents involved
    agentMetrics?: AgentMetric[];  // NEW: Per-agent metrics
    raceParticipants?: string[];  // NEW: For raceAgents - all participating agents
    raceWinners?: string[];       // NEW: For raceAgents - winning agent(s)
  };
}

// NEW: Per-agent metrics for tracing
export interface AgentMetric {
  agentName: string;
  turns: number;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  toolCalls: number;
  duration: number;
}

export interface StreamResult<TOutput = string> {
  textStream: AsyncIterable<string>;
  fullStream: AsyncIterable<StreamChunk>;
  completed: Promise<RunResult<TOutput>>;
}

export interface StreamChunk {
  type: 'text-delta' | 'tool-call' | 'tool-result' | 'step-finish' | 'finish';
  textDelta?: string;
  toolCall?: {
    toolName: string;
    args: any;
  };
  toolResult?: {
    toolName: string;
    result: any;
  };
  step?: StepResult;
}

export interface StepResult {
  stepNumber: number;
  toolCalls: Array<{
    toolName: string;
    args: any;
    result: any;
  }>;
  text?: string;
  finishReason?: string;
}

export interface RunState {
  agent: Agent<any, any>;
  messages: CoreMessage[];
  context: any;
  stepNumber: number;
  pendingApprovals?: Array<{
    toolName: string;
    args: any;
    approved: boolean;
  }>;
}

export interface RunContextWrapper<TContext> {
  context: TContext;
  agent: Agent<TContext, any>;
  messages: CoreMessage[];
  usage: Usage;  // Track token usage across the run
}

// ============================================
// SESSION INTERFACE
// ============================================

export interface Session<TContextType = any> {
  /**
   * Unique identifier for this session
   */
  id: string;

  /**
   * Load conversation history from storage
   */
  getHistory(): Promise<CoreMessage[]>;

  /**
   * Add new messages to the session
   */
  addMessages(messages: CoreMessage[]): Promise<void>;

  /**
   * Clear session history
   */
  clear(): Promise<void>;

  /**
   * Get session metadata/context
   */
  getMetadata(): Promise<Record<string, any>>;

  /**
   * Update session metadata
   */
  updateMetadata(metadata: Record<string, any>): Promise<void>;
}

// ============================================
// GUARDRAIL INTERFACE
// ============================================

export interface Guardrail<TContext = any> {
  name: string;
  type: 'input' | 'output';
  validate: (
    content: string,
    context: RunContextWrapper<TContext>
  ) => Promise<GuardrailResult> | GuardrailResult;
}

export interface GuardrailResult {
  passed: boolean;
  message?: string;
  metadata?: Record<string, any>;
}

// ============================================
// AGENT CLASS
// ============================================

export class Agent<TContext = any, TOutput = string> extends AgentHooks<TContext, TOutput> {
  public readonly name: string;
  public handoffDescription?: string;  // NEW: Description for LLM to know when to handoff
  private instructions: string | ((context: RunContextWrapper<TContext>) => string | Promise<string>);
  private model: LanguageModel;
  private tools: Record<string, CoreTool>;
  public handoffs: Agent<TContext, any>[];  // Public for Runner access
  private guardrails: Guardrail<TContext>[];
  private outputSchema?: z.ZodSchema<TOutput>;
  private maxSteps: number;
  private modelSettings?: AgentConfig<TContext, TOutput>['modelSettings'];
  private onStepFinish?: (step: StepResult) => void | Promise<void>;
  private shouldFinish?: (context: TContext, toolResults: any[]) => boolean;

  constructor(config: AgentConfig<TContext, TOutput>) {
    super(); // Initialize EventEmitter
    this.name = config.name;
    this.handoffDescription = config.handoffDescription;  // NEW
    this.instructions = config.instructions;
    this.model = config.model || getDefaultModel();
    this.tools = config.tools || {};
    this.handoffs = config.handoffs || [];
    this.guardrails = config.guardrails || [];
    this.outputSchema = config.outputSchema || config.outputType;  // NEW: Support both
    this.maxSteps = config.maxSteps || 10;
    this.modelSettings = config.modelSettings;
    this.onStepFinish = config.onStepFinish;
    this.shouldFinish = config.shouldFinish;

    // Add handoff tools automatically
    this._setupHandoffTools();
  }

  /**
   * Create method for better TypeScript inference
   */
  static create<TContext = any, TOutput = string>(
    config: AgentConfig<TContext, TOutput>
  ): Agent<TContext, TOutput> {
    return new Agent(config);
  }

  /**
   * Create handoff tools for delegating to other agents
   */
  private _setupHandoffTools(): void {
    for (const handoffAgent of this.handoffs) {
      const handoffToolName = `handoff_to_${handoffAgent.name.toLowerCase().replace(/\s+/g, '_')}`;
      
      // Use handoffDescription if available, otherwise use generic description
      const description = handoffAgent.handoffDescription 
        ? `Handoff to ${handoffAgent.name}: ${handoffAgent.handoffDescription}`
        : `Handoff to ${handoffAgent.name} agent to handle this task`;
      
      this.tools[handoffToolName] = {
        description,
        parameters: z.object({
          reason: z.string().describe('Reason for handing off to this agent'),
          context: z.string().optional().describe('Additional context for the handoff')
        }),
        execute: async ({ reason, context: handoffContext }) => {
          // Return a special marker with agent NAME only (not reference)
          // The Runner will resolve the actual agent
          return {
            __handoff: true,
            agentName: handoffAgent.name,  // Just the name, not the agent object
            reason,
            context: handoffContext
          };
        }
      };
    }
  }

  /**
   * Get system instructions (supports dynamic functions)
   */
  async getInstructions(context: RunContextWrapper<TContext>): Promise<string> {
    if (typeof this.instructions === 'function') {
      return await this.instructions(context);
    }
    return this.instructions;
  }

  /**
   * Clone this agent with optional property overrides
   */
  clone(overrides: Partial<AgentConfig<TContext, TOutput>>): Agent<TContext, TOutput> {
    return new Agent({
      name: overrides.name ?? this.name,
      instructions: overrides.instructions ?? this.instructions,
      model: overrides.model ?? this.model,
      tools: overrides.tools ?? this.tools,
      handoffs: overrides.handoffs ?? this.handoffs,
      guardrails: overrides.guardrails ?? this.guardrails,
      outputSchema: overrides.outputSchema ?? this.outputSchema,
      maxSteps: overrides.maxSteps ?? this.maxSteps,
      modelSettings: overrides.modelSettings ?? this.modelSettings,
      onStepFinish: overrides.onStepFinish ?? this.onStepFinish,
      shouldFinish: overrides.shouldFinish ?? this.shouldFinish
    });
  }

  /**
   * Convert this agent to a tool (for "agent as tool" pattern)
   */
  asTool(options: {
    toolName?: string;
    toolDescription?: string;
  } = {}): CoreTool {
    const _toolName = options.toolName || `agent_${this.name.toLowerCase().replace(/\s+/g, '_')}`;
    const toolDescription = options.toolDescription || `Delegate to ${this.name}`;

    return {
      description: toolDescription,
      parameters: z.object({
        query: z.string().describe('Query or request for the agent')
      }),
      execute: async ({ query }, context) => {
        // Run the agent and return its output
        const result = await run(this, query, {
          context: context as TContext
        });
        return result.finalOutput;
      }
    };
  }

  // Getters for internal access
  get _model() { return this.model; }
  get _tools() { return this.tools; }
  get _guardrails() { return this.guardrails; }
  get _outputSchema() { return this.outputSchema; }
  get _maxSteps() { return this.maxSteps; }
  get _modelSettings() { return this.modelSettings; }
  get _onStepFinish() { return this.onStepFinish; }
  get _shouldFinish() { return this.shouldFinish; }
}

// ============================================
// RUNNER
// ============================================

/**
 * Run an agent with a user message
 */
export async function run<TContext = any, TOutput = string>(
  agent: Agent<TContext, TOutput>,
  input: string | CoreMessage[] | RunState,
  options: RunOptions<TContext> = {}
): Promise<RunResult<TOutput>> {
  // Handle resuming from RunState
  if (isRunState(input)) {
    return await resumeRun(input, options);
  }

  const runner = new Runner(agent, options);
  return await runner.execute(input);
}

/**
 * Run an agent with streaming
 */
export async function runStream<TContext = any, TOutput = string>(
  agent: Agent<TContext, TOutput>,
  input: string | CoreMessage[],
  options: RunOptions<TContext> = {}
): Promise<StreamResult<TOutput>> {
  const runner = new Runner(agent, { ...options, stream: true });
  return await runner.executeStream(input);
}

/**
 * Resume a run from a saved state (for human-in-the-loop)
 */
async function resumeRun<TContext = any, TOutput = string>(
  state: RunState,
  options: RunOptions<TContext> = {}
): Promise<RunResult<TOutput>> {
  const runner = new Runner(state.agent, {
    ...options,
    context: state.context
  });
  
  return await runner.execute(state.messages, state);
}

function isRunState(input: any): input is RunState {
  return input && typeof input === 'object' && 'agent' in input && 'messages' in input;
}

// ============================================
// RUNNER IMPLEMENTATION
// ============================================

class Runner<TContext = any, TOutput = string> extends RunHooks<TContext, TOutput> {
  private agent: Agent<TContext, TOutput>;
  private options: RunOptions<TContext>;
  private context: TContext;
  private session?: Session<TContext>;
  private steps: StepResult[] = [];
  private totalTokens = 0;
  private promptTokens = 0;
  private completionTokens = 0;
  private handoffChain: string[] = [];
  private agentMetrics: Map<string, AgentMetric> = new Map();
  private trace: any = null; // Langfuse trace
  private currentAgentSpan: any = null; // Current agent span for nesting
  private wrappedToolsCache: Map<string, Record<string, CoreTool>> = new Map(); // Cache wrapped tools per agent

  constructor(agent: Agent<TContext, TOutput>, options: RunOptions<TContext>) {
    super(); // Initialize EventEmitter
    this.agent = agent;
    this.options = options;
    this.context = options.context || {} as TContext;
    this.session = options.session;
  }

  /**
   * Wrap tools to automatically inject context (similar to OpenAI Agents SDK's RunContext)
   * This allows tools to access context without manual workarounds
   * OPTIMIZED: Cache wrapped tools per agent
   */
  private wrapToolsWithContext(
    agentName: string,
    tools: Record<string, CoreTool>,
    contextWrapper: RunContextWrapper<TContext>
  ): Record<string, CoreTool> {
    // Check cache first
    const cached = this.wrappedToolsCache.get(agentName);
    if (cached) {
      // Update context reference for cached tools
      for (const tool of Object.values(cached)) {
        (tool as any)._contextWrapper = contextWrapper;
      }
      return cached;
    }
    
    // Create wrapped tools
    const wrapped: Record<string, CoreTool> = {};
    
    for (const [name, tool] of Object.entries(tools)) {
      const originalExecute = tool.execute;
      const wrappedTool = {
        ...tool,
        execute: async (args: any, options: any) => {
          // Get current context from wrapper
          const ctx = (wrappedTool as any)._contextWrapper;
          if (originalExecute) {
            return await originalExecute(args, ctx as any);
          }
          return {};
        }
      };
      (wrappedTool as any)._contextWrapper = contextWrapper;
      wrapped[name] = wrappedTool;
    }
    
    // Cache for future use
    this.wrappedToolsCache.set(agentName, wrapped);
    return wrapped;
  }

  async execute(
    input: string | CoreMessage[],
    resumeState?: RunState
  ): Promise<RunResult<TOutput>> {
    // Get or create Langfuse trace from context
    let trace = getCurrentTrace();
    
    if (!trace && isLangfuseEnabled()) {
      // Only create trace if not already in a trace context
      trace = createTrace({
        name: `Agent Run: ${this.agent.name}`,
        metadata: {
          agentName: this.agent.name,
          maxTurns: this.options.maxTurns || 50,
        },
        tags: ['agent', 'run'],
      });
    }
    
    this.trace = trace;

    // Prepare messages
    let messages = await this.prepareMessages(input);
    let currentAgent = this.agent;
    let stepNumber = resumeState?.stepNumber || 0;

    // Run guardrails on input
    if (!resumeState) {
      await this.runInputGuardrails(messages);
    }

    // CRITICAL: Wrap entire execution in try-finally to GUARANTEE span cleanup
    try {
    // Main agent loop
    while (stepNumber < (this.options.maxTurns || 50)) {
      stepNumber++;

      // Create or update agent span when agent changes
      if (!this.currentAgentSpan || this.currentAgentSpan._agentName !== currentAgent.name) {
        // End previous agent span if exists (with full output)
        if (this.currentAgentSpan) {
          const prevAgentMetric = this.agentMetrics.get(this.currentAgentSpan._agentName);
          const tokensDelta = {
            prompt: this.promptTokens - (this.currentAgentSpan._startTokens?.prompt || 0),
            completion: this.completionTokens - (this.currentAgentSpan._startTokens?.completion || 0),
            total: this.totalTokens - (this.currentAgentSpan._startTokens?.total || 0),
          };
          
          this.currentAgentSpan.end({
            output: {
              totalSteps: this.steps.length - (this.currentAgentSpan._startStepCount || 0),
              totalToolCalls: prevAgentMetric?.toolCalls || 0,
              totalTransfers: 1,
            },
            metadata: {
              totalSteps: this.steps.length,
              totalToolCalls: prevAgentMetric?.toolCalls || 0,
              totalTransfers: 1,
            },
          });
          this.currentAgentSpan._ended = true;
        }

        // Emit agent_start event
        const contextWrapper: RunContextWrapper<TContext> = {
          context: this.context,
          agent: currentAgent,
          messages,
          usage: new Usage(),
        };
        this.emit('agent_start', contextWrapper, currentAgent);
        currentAgent.emit('agent_start', contextWrapper, currentAgent);

        // Create new agent span using context (auto-nests under trace)
        if (this.trace) {
          // Get parent from context or use trace
          const parent = getCurrentSpan() || this.trace;
          
          this.currentAgentSpan = parent.span({
            name: `Agent: ${currentAgent.name}`,
            input: {
              messages: formatMessagesForLangfuse(messages),
              stepNumber,
              turnNumber: stepNumber,
            },
            metadata: {
              agentName: currentAgent.name,
              tools: Object.keys(currentAgent._tools || {}),
              handoffs: currentAgent.handoffs.map(a => a.name),
              stepNumber,
              turnNumber: stepNumber,
              transferCount: 0,
              toolCallCount: 0,
              architecture: 'flat',
            },
          });
          this.currentAgentSpan._agentName = currentAgent.name; // Track which agent this span is for
          this.currentAgentSpan._startStepCount = this.steps.length; // Track starting step count
          this.currentAgentSpan._startTokens = {
            prompt: this.promptTokens,
            completion: this.completionTokens,
            total: this.totalTokens,
          };
          
          // Set as current span in context
          setCurrentSpan(this.currentAgentSpan);
        }
      }

      // Get system instructions
      const contextWrapper: RunContextWrapper<TContext> = {
        context: this.context,
        agent: currentAgent,
        messages,
        usage: new Usage({
          promptTokens: this.promptTokens,
          completionTokens: this.completionTokens,
        }),
      };
      
      const systemMessage = await currentAgent.getInstructions(contextWrapper);

      // Create generation span NESTED under agent span
      // OPTIMIZED: Only create if span exists (avoid unnecessary checks)
      let generation: any = null;
      if (this.currentAgentSpan) {
        generation = this.currentAgentSpan.generation({
          name: `Generation - Step ${stepNumber}`,
          model: extractModelName(currentAgent._model),
          input: formatMessagesForLangfuse(messages),
          metadata: {
            stepNumber,
            agentName: currentAgent.name,
            systemMessage,
          },
        });
      }

      // Wrap tools to inject context automatically (similar to OpenAI Agents SDK)
      const wrappedTools = this.wrapToolsWithContext(currentAgent.name, currentAgent._tools, contextWrapper);

      // For coordinator agents with ONLY handoff tools, force tool usage and limit to 1 step
      const hasOnlyHandoffTools = Object.keys(wrappedTools).every(name => name.startsWith('handoff_to_'));
      const toolChoice = hasOnlyHandoffTools && Object.keys(wrappedTools).length > 0 ? 'required' : undefined;
      const maxSteps = hasOnlyHandoffTools ? 1 : currentAgent._maxSteps; // OPTIMIZATION: 1 step for handoffs

      // Execute agent step
      const result = await generateText({
        model: currentAgent._model,
        system: systemMessage,
        messages,
        tools: wrappedTools,
        toolChoice: toolChoice as any,
        maxSteps: maxSteps,
        temperature: currentAgent._modelSettings?.temperature,
        topP: currentAgent._modelSettings?.topP,
        maxTokens: currentAgent._modelSettings?.maxTokens,
        presencePenalty: currentAgent._modelSettings?.presencePenalty,
        frequencyPenalty: currentAgent._modelSettings?.frequencyPenalty
      });

      // Extract tool results from the AI SDK response
      // OPTIMIZED: Use Map for O(1) lookup instead of nested loops
      let toolCalls: Array<{ toolName: string; args: any; result: any }> = [];
      
      if (result.response?.messages) {
        const msgs = result.response.messages;
        
        // Build a map of toolCallId -> result for O(1) lookup
        const resultMap = new Map<string, any>();
        for (const msg of msgs) {
          if (msg.role === 'tool' && Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if ((part as any).type === 'tool-result') {
                resultMap.set((part as any).toolCallId, (part as any).result);
              }
            }
          }
        }
        
        // Extract tool calls and match with results
        for (const msg of msgs) {
          if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if ((part as any).type === 'tool-call') {
                const toolCallId = (part as any).toolCallId;
                const result = resultMap.get(toolCallId);
                if (result !== undefined) {
                  toolCalls.push({
                    toolName: (part as any).toolName,
                    args: (part as any).args,
                    result
                  });
                }
              }
            }
          }
        }
      }

      // Update token usage and metrics
      if (result.usage) {
        this.totalTokens += result.usage.totalTokens;
        this.promptTokens += result.usage.promptTokens;
        this.completionTokens += result.usage.completionTokens;
        
        // Record agent-specific usage with tool count
        this.recordAgentUsage(currentAgent.name, {
          prompt: result.usage.promptTokens,
          completion: result.usage.completionTokens,
          total: result.usage.totalTokens,
        }, toolCalls.length);

        // Update and END Langfuse generation with usage data
        if (generation) {
          // For tool calls, include tool info in output, otherwise use text
          const generationOutput = result.finishReason === 'tool-calls' && toolCalls.length > 0
            ? { toolCalls: toolCalls.map(tc => ({ tool: tc.toolName, args: tc.args })), text: result.text || '' }
            : result.text;
            
          generation.end({
            output: generationOutput,
            usage: {
              input: result.usage.promptTokens,
              output: result.usage.completionTokens,
              total: result.usage.totalTokens,
            },
            metadata: {
              finishReason: result.finishReason,
              toolCallsCount: toolCalls.length,
              totalToolCalls: toolCalls.length,
            },
          });
        }
      }

      // Check for handoffs
      const handoff = this.detectHandoff(toolCalls, currentAgent);
      if (handoff) {
        // Emit agent_handoff event
        const contextWrapper: RunContextWrapper<TContext> = {
          context: this.context,
          agent: currentAgent,
          messages,
          usage: new Usage(),
        };
        this.emit('agent_handoff', contextWrapper, handoff.agent);
        currentAgent.emit('agent_handoff', contextWrapper, handoff.agent);

        // CRITICAL: Close current agent span before switching
        if (this.currentAgentSpan && !this.currentAgentSpan._ended) {
          const agentMetric = this.agentMetrics.get(this.currentAgentSpan._agentName);
          const tokensDelta = {
            prompt: this.promptTokens - (this.currentAgentSpan._startTokens?.prompt || 0),
            completion: this.completionTokens - (this.currentAgentSpan._startTokens?.completion || 0),
            total: this.totalTokens - (this.currentAgentSpan._startTokens?.total || 0),
          };

          // Create handoff span NESTED under current agent span
          const handoffSpan = this.currentAgentSpan.span({
            name: `Handoff: ${currentAgent.name} → ${handoff.agent.name}`,
            input: { 
              from: currentAgent.name, 
              to: handoff.agent.name, 
              reason: handoff.reason 
            },
            metadata: { 
              type: 'handoff',
              fromAgent: currentAgent.name,
              toAgent: handoff.agent.name,
              handoffReason: handoff.reason 
            },
          });
          if (handoffSpan) {
            handoffSpan.end({
              output: { success: true, nextAgent: handoff.agent.name },
            });
          }

          // End current agent span with handoff info
          this.currentAgentSpan.end({
            output: {
              handoffTo: handoff.agent.name,
              handoffReason: handoff.reason,
              stepCount: this.steps.length - (this.currentAgentSpan._startStepCount || 0),
              totalSteps: this.steps.length,
              totalToolCalls: agentMetric?.toolCalls || 0,
            },
            metadata: {
              totalSteps: this.steps.length,
              totalToolCalls: agentMetric?.toolCalls || 0,
              handoffTo: handoff.agent.name,
              handoffReason: handoff.reason,
            },
          });
          this.currentAgentSpan._ended = true;
          this.currentAgentSpan = null;
          setCurrentSpan(null);
        }

        // Track handoff chain
        if (!this.handoffChain.includes(currentAgent.name)) {
          this.handoffChain.push(currentAgent.name);
        }
        this.handoffChain.push(handoff.agent.name);
        
        // Switch to handoff agent
        currentAgent = handoff.agent;
        messages.push({
          role: 'assistant',
          content: `Handing off to ${handoff.agent.name}. Reason: ${handoff.reason}`
        });
        
        // Continue loop - new agent span will be created on next iteration
        continue;
      }

      // Record step
      const step: StepResult = {
        stepNumber,
        toolCalls,
        text: result.text,
        finishReason: result.finishReason
      };
      this.steps.push(step);

      // Call step finish hook
      if (currentAgent._onStepFinish) {
        await currentAgent._onStepFinish(step);
      }

      // Add messages from result (includes assistant + tool messages if tools were called)
      // OPTIMIZED: Only add new messages, avoid slice operation
      if (result.response && result.response.messages) {
        const responseMessages = result.response.messages;
        const startIdx = messages.length;
        if (responseMessages.length > startIdx) {
          // Only push new messages, avoiding slice
          for (let i = startIdx; i < responseMessages.length; i++) {
            messages.push(responseMessages[i]);
          }
        }
      } else {
        // Fallback: just add assistant message
        messages.push({
          role: 'assistant',
          content: result.text
        });
      }

      // Check if we should finish
      const shouldFinish = currentAgent._shouldFinish 
        ? currentAgent._shouldFinish(this.context, toolCalls.map(tc => tc.result))
        : result.finishReason === 'stop' || !result.toolCalls?.length;

      if (shouldFinish) {
        // Run output guardrails
        await this.runOutputGuardrails(result.text);

        // Parse output if schema provided
        let finalOutput: TOutput;
        if (currentAgent._outputSchema) {
          finalOutput = currentAgent._outputSchema.parse(JSON.parse(result.text));
        } else {
          finalOutput = result.text as TOutput;
        }

        // Save to session
        if (this.session) {
          await this.session.addMessages(messages);
        }

        // End current agent span with full output
        if (this.currentAgentSpan) {
          const agentMetric = this.agentMetrics.get(this.currentAgentSpan._agentName);
          const tokensDelta = {
            prompt: this.promptTokens - (this.currentAgentSpan._startTokens?.prompt || 0),
            completion: this.completionTokens - (this.currentAgentSpan._startTokens?.completion || 0),
            total: this.totalTokens - (this.currentAgentSpan._startTokens?.total || 0),
          };
          
          this.currentAgentSpan.end({
            output: {
              finalOutput: typeof finalOutput === 'string' ? finalOutput.substring(0, 500) : finalOutput,
              stepCount: this.steps.length - (this.currentAgentSpan._startStepCount || 0),
              totalSteps: this.steps.length,
              totalToolCalls: agentMetric?.toolCalls || 0,
              totalTransfers: 0,
              messagesProduced: messages.length,
              finishReason: result.finishReason,
            },
            metadata: {
              totalSteps: this.steps.length,
              totalToolCalls: agentMetric?.toolCalls || 0,
              totalTransfers: 0,
            },
          });
          this.currentAgentSpan._ended = true;
        }

        return {
          finalOutput,
          messages,
          steps: this.steps,
          metadata: {
            totalTokens: this.totalTokens,
            promptTokens: this.promptTokens,
            completionTokens: this.completionTokens,
            finishReason: result.finishReason,
            totalToolCalls: this.steps.reduce((sum, step) => sum + (step.toolCalls?.length || 0), 0),
            handoffChain: this.handoffChain.length > 0 ? this.handoffChain : undefined,
            agentMetrics: Array.from(this.agentMetrics.values()),
          }
        };
      }
    }

    // End current agent span before throwing (max turns)
    if (this.currentAgentSpan) {
      const agentMetric = this.agentMetrics.get(this.currentAgentSpan._agentName);
      const tokensDelta = {
        prompt: this.promptTokens - (this.currentAgentSpan._startTokens?.prompt || 0),
        completion: this.completionTokens - (this.currentAgentSpan._startTokens?.completion || 0),
        total: this.totalTokens - (this.currentAgentSpan._startTokens?.total || 0),
      };
      
      this.currentAgentSpan.end({
        output: {
          error: 'Max turns exceeded',
          stepCount: this.steps.length,
          totalSteps: this.steps.length,
          totalToolCalls: agentMetric?.toolCalls || 0,
          totalTransfers: 0,
        },
        level: 'ERROR',
        statusMessage: 'Max turns exceeded',
      });
      this.currentAgentSpan._ended = true;
    }
    
    throw new Error('Max turns exceeded');
    
    } finally {
      // CRITICAL: Always cleanup spans, even on errors/interruptions
      // This ensures Langfuse traces are ALWAYS properly closed
      if (this.currentAgentSpan) {
        try {
          const agentMetric = this.agentMetrics.get(this.currentAgentSpan._agentName);
          const tokensDelta = {
            prompt: this.promptTokens - (this.currentAgentSpan._startTokens?.prompt || 0),
            completion: this.completionTokens - (this.currentAgentSpan._startTokens?.completion || 0),
            total: this.totalTokens - (this.currentAgentSpan._startTokens?.total || 0),
          };
          
          // Only end if not already ended
          if (!this.currentAgentSpan._ended) {
          this.currentAgentSpan.end({
            output: {
              totalSteps: this.steps.length,
              totalToolCalls: agentMetric?.toolCalls || 0,
            },
          });
          this.currentAgentSpan._ended = true;
        }
      } catch (error) {
        console.error('[Trace Cleanup] Failed to close agent span:', error);
      } finally {
        this.currentAgentSpan = null;
        setCurrentSpan(null);
      }
    }
    }
  }

  async executeStream(
    input: string | CoreMessage[]
  ): Promise<StreamResult<TOutput>> {
    const messages = await this.prepareMessages(input);
    
    // Run input guardrails
    await this.runInputGuardrails(messages);

    const contextWrapper: RunContextWrapper<TContext> = {
      context: this.context,
      agent: this.agent,
      messages,
      usage: new Usage(),
    };
    
    const systemMessage = await this.agent.getInstructions(contextWrapper);

    // Wrap tools to inject context automatically (same as non-streaming)
    const wrappedTools = this.wrapToolsWithContext(this.agent.name, this.agent._tools, contextWrapper);

    const result = streamText({
      model: this.agent._model,
      system: systemMessage,
      messages,
      tools: wrappedTools,
      maxSteps: this.agent._maxSteps,
      temperature: this.agent._modelSettings?.temperature,
      topP: this.agent._modelSettings?.topP,
      maxTokens: this.agent._modelSettings?.maxTokens
    });

    // Create text stream
    const textStream = result.textStream;

    // Create full stream with events
    const fullStream = this.createFullStream(result);

    // Create completion promise
    const completed = this.handleStreamCompletion(result, messages);

    return {
      textStream,
      fullStream,
      completed
    };
  }

  private async *createFullStream(result: any): AsyncIterable<StreamChunk> {
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        yield {
          type: 'text-delta',
          textDelta: chunk.textDelta
        };
      } else if (chunk.type === 'tool-call') {
        yield {
          type: 'tool-call',
          toolCall: {
            toolName: chunk.toolName,
            args: chunk.args
          }
        };
      } else if (chunk.type === 'tool-result') {
        yield {
          type: 'tool-result',
          toolResult: {
            toolName: chunk.toolName,
            result: chunk.result
          }
        };
      } else if (chunk.type === 'finish') {
        yield {
          type: 'finish'
        };
      }
    }
  }

  private async handleStreamCompletion(
    result: any,
    messages: CoreMessage[]
  ): Promise<RunResult<TOutput>> {
    let fullText = '';
    const toolCalls: Array<{ toolName: string; args: any; result: any }> = [];

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        fullText += chunk.textDelta;
      } else if (chunk.type === 'tool-result') {
        toolCalls.push({
          toolName: chunk.toolName,
          args: chunk.args,
          result: chunk.result
        });
      }
    }

    // Add assistant message
    messages.push({
      role: 'assistant',
      content: fullText
    });

    // Run output guardrails
    await this.runOutputGuardrails(fullText);

    // Save to session
    if (this.session) {
      await this.session.addMessages(messages);
    }

    // Parse output
    let finalOutput: TOutput;
    if (this.agent._outputSchema) {
      finalOutput = this.agent._outputSchema.parse(JSON.parse(fullText));
    } else {
      finalOutput = fullText as TOutput;
    }

    const step: StepResult = {
      stepNumber: 1,
      toolCalls,
      text: fullText
    };
    this.steps.push(step);

    if (this.agent._onStepFinish) {
      await this.agent._onStepFinish(step);
    }

    return {
      finalOutput,
      messages,
      steps: this.steps,
      metadata: {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0
      }
    };
  }

  private async prepareMessages(
    input: string | CoreMessage[]
  ): Promise<CoreMessage[]> {
    let newMessages: CoreMessage[];

    if (typeof input === 'string') {
      newMessages = [{ role: 'user', content: input }];
    } else {
      newMessages = input;
    }

    // Load session history if available
    if (this.session) {
      const history = await this.session.getHistory();
      
      if (this.options.sessionInputCallback) {
        return this.options.sessionInputCallback(history, newMessages);
      }
      
      return [...history, ...newMessages];
    }

    return newMessages;
  }

  private async runInputGuardrails(messages: CoreMessage[]): Promise<void> {
    const inputGuardrails = this.agent._guardrails.filter(g => g.type === 'input');
    
    for (const guardrail of inputGuardrails) {
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (lastUserMessage && typeof lastUserMessage.content === 'string') {
        const contextWrapper: RunContextWrapper<TContext> = {
          context: this.context,
          agent: this.agent,
          messages,
          usage: new Usage(),
        };
        
        const result = await guardrail.validate(lastUserMessage.content, contextWrapper);
        
        if (!result.passed) {
          throw new Error(`Input guardrail "${guardrail.name}" failed: ${result.message}`);
        }
      }
    }
  }

  private async runOutputGuardrails(output: string): Promise<void> {
    const outputGuardrails = this.agent._guardrails.filter(g => g.type === 'output');
    
    for (const guardrail of outputGuardrails) {
      const contextWrapper: RunContextWrapper<TContext> = {
        context: this.context,
        agent: this.agent,
        messages: [],
        usage: new Usage(),
      };
      
      const result = await guardrail.validate(output, contextWrapper);
      
      if (!result.passed) {
        throw new Error(`Output guardrail "${guardrail.name}" failed: ${result.message}`);
      }
    }
  }

  private detectHandoff(toolCalls: Array<{ toolName: string; args: any; result: any }>, currentAgent: Agent<any, any>) {
    for (const tc of toolCalls) {
      if (tc.result?.__handoff) {
        // Resolve agent by name from the current agent's handoffs
        const agentName = tc.result.agentName;
        const targetAgent = currentAgent.handoffs.find(a => a.name === agentName);
        
        if (!targetAgent) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️  Handoff target agent "${agentName}" not found in ${currentAgent.name}'s handoffs`);
          }
          return null;
        }
        
        return {
          agent: targetAgent,
          reason: tc.result.reason,
          context: tc.result.context
        };
      }
    }
    return null;
  }

  /**
   * Record agent usage for metrics
   * OPTIMIZED: Cache last step tool count to avoid array lookup
   */
  private recordAgentUsage(agentName: string, tokens: { prompt: number; completion: number; total: number }, toolCallCount: number = 0): void {
    const existing = this.agentMetrics.get(agentName);
    if (existing) {
      existing.turns++;
      existing.tokens.input += tokens.prompt;
      existing.tokens.output += tokens.completion;
      existing.tokens.total += tokens.total;
      existing.toolCalls += toolCallCount;
    } else {
      this.agentMetrics.set(agentName, {
        agentName,
        turns: 1,
        tokens: {
          input: tokens.prompt,
          output: tokens.completion,
          total: tokens.total,
        },
        toolCalls: toolCallCount,
        duration: 0,
      });
    }
  }
}

// ============================================
// DEFAULT MODEL
// ============================================

let defaultModel: LanguageModel | null = null;

export function setDefaultModel(model: LanguageModel): void {
  defaultModel = model;
}

function getDefaultModel(): LanguageModel {
  if (!defaultModel) {
    throw new Error('No default model set. Call setDefaultModel() first or provide a model in AgentConfig.');
  }
  return defaultModel;
}

// ============================================
// UTILITY: TOOL HELPER
// ============================================

/**
 * Create a tool from a function (similar to OpenAI's @function_tool)
 */
export function tool<TParams extends z.ZodObject<any>>(config: {
  name?: string;
  description: string;
  parameters: TParams;
  execute: (args: z.infer<TParams>, context?: any) => Promise<any> | any;
}): CoreTool {
  return {
    description: config.description,
    parameters: config.parameters,
    execute: config.execute
  };
}
