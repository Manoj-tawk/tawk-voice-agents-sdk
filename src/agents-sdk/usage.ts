/**
 * Usage Tracking
 * 
 * Tracks token usage and request counts across agent runs.
 * 
 * @module usage
 */

/**
 * Tracks token usage and request counts for an agent run.
 */
export class Usage {
  /**
   * The number of requests made to the LLM API.
   */
  public requests: number;

  /**
   * The number of input tokens used across all requests.
   */
  public inputTokens: number;

  /**
   * The number of output tokens used across all requests.
   */
  public outputTokens: number;

  /**
   * The total number of tokens sent and received, across all requests.
   */
  public totalTokens: number;

  constructor(input?: {
    requests?: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    // AI SDK format
    promptTokens?: number;
    completionTokens?: number;
  }) {
    if (typeof input === 'undefined') {
      this.requests = 0;
      this.inputTokens = 0;
      this.outputTokens = 0;
      this.totalTokens = 0;
    } else {
      this.requests = input?.requests ?? 1;
      // Support both formats
      this.inputTokens = input?.inputTokens ?? input?.promptTokens ?? 0;
      this.outputTokens = input?.outputTokens ?? input?.completionTokens ?? 0;
      this.totalTokens = input?.totalTokens ?? 
        (this.inputTokens + this.outputTokens);
    }
  }

  /**
   * Add usage from another Usage instance
   */
  add(newUsage: Usage): void {
    this.requests += newUsage.requests;
    this.inputTokens += newUsage.inputTokens;
    this.outputTokens += newUsage.outputTokens;
    this.totalTokens += newUsage.totalTokens;
  }

  /**
   * Convert to JSON for serialization
   */
  toJSON() {
    return {
      requests: this.requests,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: this.totalTokens,
    };
  }
}

