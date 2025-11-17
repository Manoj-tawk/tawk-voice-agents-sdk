/**
 * Session Implementations
 * 
 * Provides automatic conversation history management across agent runs.
 */

import type { CoreMessage } from 'ai';
import type { Session } from './agent';
import { Redis } from 'ioredis';

// ============================================
// IN-MEMORY SESSION (for development/testing)
// ============================================

export class MemorySession<TContext = any> implements Session<TContext> {
  public readonly id: string;
  private messages: CoreMessage[] = [];
  private metadata: Record<string, any> = {};
  private maxMessages?: number;
  private summarizationConfig?: SummarizationConfig;

  constructor(id: string, maxMessages?: number, summarizationConfig?: SummarizationConfig) {
    this.id = id;
    this.maxMessages = maxMessages;
    this.summarizationConfig = summarizationConfig;
  }

  async getHistory(): Promise<CoreMessage[]> {
    return [...this.messages];
  }

  async addMessages(messages: CoreMessage[]): Promise<void> {
    this.messages.push(...messages);
    
    // Check if we should summarize
    if (this.summarizationConfig?.enabled) {
      this.messages = await this.checkAndSummarize(this.messages);
    }
    // Otherwise, use simple sliding window
    else if (this.maxMessages && this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  private async checkAndSummarize(messages: CoreMessage[]): Promise<CoreMessage[]> {
    if (!this.summarizationConfig) return messages;
    
    const { messageThreshold, keepRecentMessages } = this.summarizationConfig;
    
    // Count non-system messages (exclude existing summaries)
    const nonSystemMessages = messages.filter(msg => 
      !(msg.role === 'system' && typeof msg.content === 'string' && msg.content.includes('Previous conversation summary'))
    );
    
    // Only summarize if we exceed threshold
    if (nonSystemMessages.length <= messageThreshold) {
      return messages;
    }
    
    try {
      // Find existing summary (if any)
      const existingSummaryIndex = messages.findIndex(msg =>
        msg.role === 'system' && typeof msg.content === 'string' && msg.content.includes('Previous conversation summary')
      );
      
      let existingSummary: string | undefined;
      if (existingSummaryIndex >= 0) {
        const summaryMsg = messages[existingSummaryIndex];
        existingSummary = typeof summaryMsg.content === 'string' 
          ? summaryMsg.content.replace('Previous conversation summary:\n', '')
          : undefined;
        // Remove old summary
        messages.splice(existingSummaryIndex, 1);
      }
      
      // Messages to summarize (all except recent ones)
      const toSummarize = messages.slice(0, -keepRecentMessages);
      const recentMessages = messages.slice(-keepRecentMessages);
      
      // Generate summary
      const newSummary = await this.generateSummary(toSummarize, existingSummary);
      
      // Create summary as system message
      const summaryMessage: CoreMessage = {
        role: 'system',
        content: `Previous conversation summary:\n${newSummary}`
      };
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 [Memory] Summarized ${toSummarize.length} messages (${newSummary.length} chars)`);
      }
      
      // Return: [summary, recent messages]
      return [summaryMessage, ...recentMessages];
      
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`⚠️  [Memory] Summarization failed: ${error.message}`);
      }
      // Fallback to sliding window
      if (this.maxMessages && messages.length > this.maxMessages) {
        return messages.slice(-this.maxMessages);
      }
      return messages;
    }
  }

  private async generateSummary(messages: CoreMessage[], previousSummary?: string): Promise<string> {
    if (!this.summarizationConfig) {
      throw new Error('Summarization config not set');
    }
    
    // Build conversation text
    const conversationText = messages
      .map(msg => `${msg.role}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`)
      .join('\n\n');
    
    // Use custom prompt or default
    const summaryPrompt = this.summarizationConfig.summaryPrompt || 
      `Summarize the following conversation concisely, preserving all important facts, context, and information about the user. Focus on:
- User's identity (name, job, background)
- Key facts mentioned
- Topics discussed
- Important context

Conversation:
${conversationText}

Summary (2-3 paragraphs):`;

    // If previous summary exists, include it
    const fullPrompt = previousSummary 
      ? `Previous summary:\n${previousSummary}\n\n${summaryPrompt}`
      : summaryPrompt;
    
    // Use the provided model or create simple summary
    if (this.summarizationConfig.model) {
      const { generateText } = await import('ai');
      const result = await generateText({
        model: this.summarizationConfig.model,
        prompt: fullPrompt,
        maxTokens: 500,
      });
      return result.text;
    } else {
      // Simple fallback
      return this.createSimpleSummary(messages, previousSummary);
    }
  }

  private createSimpleSummary(messages: CoreMessage[], previousSummary?: string): string {
    const facts: string[] = [];
    
    messages.forEach(msg => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      
      if (content.includes("I'm") || content.includes("I am") || 
          content.includes("My name") || content.includes("I work") ||
          content.includes("I live") || content.includes("I graduated")) {
        facts.push(content);
      }
    });
    
    if (previousSummary) {
      return `${previousSummary}\n\nAdditional context: ${facts.slice(0, 5).join('. ')}`;
    }
    
    return facts.slice(0, 10).join('. ');
  }

  async clear(): Promise<void> {
    this.messages = [];
    this.metadata = {};
  }

  async getMetadata(): Promise<Record<string, any>> {
    return { ...this.metadata };
  }

  async updateMetadata(metadata: Record<string, any>): Promise<void> {
    this.metadata = { ...this.metadata, ...metadata };
  }
}

// ============================================
// REDIS SESSION (for production)
// ============================================

export interface RedisSessionConfig {
  redis: Redis;
  keyPrefix?: string;
  ttl?: number; // Time to live in seconds
  maxMessages?: number; // Maximum number of messages to keep
  summarization?: SummarizationConfig;
}

export class RedisSession<TContext = any> implements Session<TContext> {
  public readonly id: string;
  private redis: Redis;
  private keyPrefix: string;
  private ttl: number;
  private maxMessages?: number;
  private summarizationConfig?: SummarizationConfig;

  constructor(id: string, config: RedisSessionConfig) {
    this.id = id;
    this.redis = config.redis;
    this.keyPrefix = config.keyPrefix || 'agent:session:';
    this.ttl = config.ttl || 3600; // Default 1 hour
    this.maxMessages = config.maxMessages;
    this.summarizationConfig = config.summarization;
  }

  private getMessagesKey(): string {
    return `${this.keyPrefix}${this.id}:messages`;
  }

  private getMetadataKey(): string {
    return `${this.keyPrefix}${this.id}:metadata`;
  }

  async getHistory(): Promise<CoreMessage[]> {
    const messagesJson = await this.redis.get(this.getMessagesKey());
    if (!messagesJson) {
      return [];
    }
    return JSON.parse(messagesJson);
  }

  async addMessages(messages: CoreMessage[]): Promise<void> {
    const key = this.getMessagesKey();
    
    // Get existing messages
    let existingMessages = await this.getHistory();
    
    // Add new messages
    existingMessages.push(...messages);
    
    // Check if we should summarize
    if (this.summarizationConfig?.enabled) {
      existingMessages = await this.checkAndSummarize(existingMessages);
    }
    // Otherwise, use simple sliding window
    else if (this.maxMessages && existingMessages.length > this.maxMessages) {
      existingMessages = existingMessages.slice(-this.maxMessages);
    }
    
    // Save back to Redis with TTL
    await this.redis.setex(
      key,
      this.ttl,
      JSON.stringify(existingMessages)
    );
  }

  private async checkAndSummarize(messages: CoreMessage[]): Promise<CoreMessage[]> {
    if (!this.summarizationConfig) return messages;
    
    const { messageThreshold, keepRecentMessages } = this.summarizationConfig;
    
    // Count non-system messages (exclude existing summaries)
    const nonSystemMessages = messages.filter(msg => 
      !(msg.role === 'system' && typeof msg.content === 'string' && msg.content.includes('Previous conversation summary'))
    );
    
    // Only summarize if we exceed threshold
    if (nonSystemMessages.length <= messageThreshold) {
      return messages;
    }
    
    try {
      // Find existing summary (if any)
      const existingSummaryIndex = messages.findIndex(msg =>
        msg.role === 'system' && typeof msg.content === 'string' && msg.content.includes('Previous conversation summary')
      );
      
      let existingSummary: string | undefined;
      if (existingSummaryIndex >= 0) {
        const summaryMsg = messages[existingSummaryIndex];
        existingSummary = typeof summaryMsg.content === 'string' 
          ? summaryMsg.content.replace('Previous conversation summary:\n', '')
          : undefined;
        // Remove old summary
        messages.splice(existingSummaryIndex, 1);
      }
      
      // Messages to summarize (all except recent ones)
      const toSummarize = messages.slice(0, -keepRecentMessages);
      const recentMessages = messages.slice(-keepRecentMessages);
      
      // Generate summary
      const newSummary = await this.generateSummary(toSummarize, existingSummary);
      
      // Create summary as system message
      const summaryMessage: CoreMessage = {
        role: 'system',
        content: `Previous conversation summary:\n${newSummary}`
      };
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 [Redis] Summarized ${toSummarize.length} messages (${newSummary.length} chars)`);
      }
      
      // Return: [summary, recent messages]
      return [summaryMessage, ...recentMessages];
      
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`⚠️  [Redis] Summarization failed: ${error.message}`);
      }
      // Fallback to sliding window
      if (this.maxMessages && messages.length > this.maxMessages) {
        return messages.slice(-this.maxMessages);
      }
      return messages;
    }
  }

  private async generateSummary(messages: CoreMessage[], previousSummary?: string): Promise<string> {
    if (!this.summarizationConfig) {
      throw new Error('Summarization config not set');
    }
    
    // Build conversation text
    const conversationText = messages
      .map(msg => `${msg.role}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`)
      .join('\n\n');
    
    // Use custom prompt or default
    const summaryPrompt = this.summarizationConfig.summaryPrompt || 
      `Summarize the following conversation concisely, preserving all important facts, context, and information about the user. Focus on:
- User's identity (name, job, background)
- Key facts mentioned
- Topics discussed
- Important context

Conversation:
${conversationText}

Summary (2-3 paragraphs):`;

    // If previous summary exists, include it
    const fullPrompt = previousSummary 
      ? `Previous summary:\n${previousSummary}\n\n${summaryPrompt}`
      : summaryPrompt;
    
    // Use the provided model or create simple summary
    if (this.summarizationConfig.model) {
      const { generateText } = await import('ai');
      const result = await generateText({
        model: this.summarizationConfig.model,
        prompt: fullPrompt,
        maxTokens: 500,
      });
      return result.text;
    } else {
      // Simple fallback
      return this.createSimpleSummary(messages, previousSummary);
    }
  }

  private createSimpleSummary(messages: CoreMessage[], previousSummary?: string): string {
    const facts: string[] = [];
    
    messages.forEach(msg => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      
      if (content.includes("I'm") || content.includes("I am") || 
          content.includes("My name") || content.includes("I work") ||
          content.includes("I live") || content.includes("I graduated")) {
        facts.push(content);
      }
    });
    
    if (previousSummary) {
      return `${previousSummary}\n\nAdditional context: ${facts.slice(0, 5).join('. ')}`;
    }
    
    return facts.slice(0, 10).join('. ');
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.redis.del(this.getMessagesKey()),
      this.redis.del(this.getMetadataKey())
    ]);
  }

  async getMetadata(): Promise<Record<string, any>> {
    const metadataJson = await this.redis.get(this.getMetadataKey());
    if (!metadataJson) {
      return {};
    }
    return JSON.parse(metadataJson);
  }

  async updateMetadata(metadata: Record<string, any>): Promise<void> {
    const key = this.getMetadataKey();
    
    // Get existing metadata
    const existingMetadata = await this.getMetadata();
    
    // Merge with new metadata
    const updatedMetadata = { ...existingMetadata, ...metadata };
    
    // Save back to Redis with TTL
    await this.redis.setex(
      key,
      this.ttl,
      JSON.stringify(updatedMetadata)
    );
  }

  /**
   * Refresh TTL for this session
   */
  async refreshTTL(): Promise<void> {
    await Promise.all([
      this.redis.expire(this.getMessagesKey(), this.ttl),
      this.redis.expire(this.getMetadataKey(), this.ttl)
    ]);
  }
}

// ============================================
// DATABASE SESSION (MongoDB example)
// ============================================

export interface DatabaseSessionConfig {
  db: any; // MongoDB Database instance
  collectionName?: string;
  maxMessages?: number;
  summarization?: SummarizationConfig;
}

export class DatabaseSession<TContext = any> implements Session<TContext> {
  public readonly id: string;
  private db: any;
  private collectionName: string;
  private maxMessages?: number;
  private summarizationConfig?: SummarizationConfig;

  constructor(id: string, config: DatabaseSessionConfig) {
    this.id = id;
    this.db = config.db;
    this.collectionName = config.collectionName || 'agent_sessions';
    this.maxMessages = config.maxMessages;
    this.summarizationConfig = config.summarization;
  }

  private getCollection() {
    return this.db.collection(this.collectionName);
  }

  async getHistory(): Promise<CoreMessage[]> {
    const session = await this.getCollection().findOne({ sessionId: this.id });
    return session?.messages || [];
  }

  async addMessages(messages: CoreMessage[]): Promise<void> {
    const collection = this.getCollection();
    
    // Get existing session
    let session = await collection.findOne({ sessionId: this.id });
    
    if (!session) {
      // Create new session
      session = {
        sessionId: this.id,
        messages: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    
    // Add new messages
    session.messages.push(...messages);
    
    // Check if we should summarize
    if (this.summarizationConfig?.enabled) {
      session.messages = await this.checkAndSummarize(session.messages);
    }
    // Otherwise, use simple sliding window
    else if (this.maxMessages && session.messages.length > this.maxMessages) {
      session.messages = session.messages.slice(-this.maxMessages);
    }
    
    session.updatedAt = new Date();
    
    // Upsert
    await collection.updateOne(
      { sessionId: this.id },
      { $set: session },
      { upsert: true }
    );
  }

  private async checkAndSummarize(messages: CoreMessage[]): Promise<CoreMessage[]> {
    if (!this.summarizationConfig) return messages;
    
    const { messageThreshold, keepRecentMessages } = this.summarizationConfig;
    
    // Count non-system messages (exclude existing summaries)
    const nonSystemMessages = messages.filter(msg => 
      !(msg.role === 'system' && typeof msg.content === 'string' && msg.content.includes('Previous conversation summary'))
    );
    
    // Only summarize if we exceed threshold
    if (nonSystemMessages.length <= messageThreshold) {
      return messages;
    }
    
    try {
      // Find existing summary (if any)
      const existingSummaryIndex = messages.findIndex(msg =>
        msg.role === 'system' && typeof msg.content === 'string' && msg.content.includes('Previous conversation summary')
      );
      
      let existingSummary: string | undefined;
      if (existingSummaryIndex >= 0) {
        const summaryMsg = messages[existingSummaryIndex];
        existingSummary = typeof summaryMsg.content === 'string' 
          ? summaryMsg.content.replace('Previous conversation summary:\n', '')
          : undefined;
        // Remove old summary
        messages.splice(existingSummaryIndex, 1);
      }
      
      // Messages to summarize (all except recent ones)
      const toSummarize = messages.slice(0, -keepRecentMessages);
      const recentMessages = messages.slice(-keepRecentMessages);
      
      // Generate summary
      const newSummary = await this.generateSummary(toSummarize, existingSummary);
      
      // Create summary as system message
      const summaryMessage: CoreMessage = {
        role: 'system',
        content: `Previous conversation summary:\n${newSummary}`
      };
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 [MongoDB] Summarized ${toSummarize.length} messages (${newSummary.length} chars)`);
      }
      
      // Return: [summary, recent messages]
      return [summaryMessage, ...recentMessages];
      
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`⚠️  [MongoDB] Summarization failed: ${error.message}`);
      }
      // Fallback to sliding window
      if (this.maxMessages && messages.length > this.maxMessages) {
        return messages.slice(-this.maxMessages);
      }
      return messages;
    }
  }

  private async generateSummary(messages: CoreMessage[], previousSummary?: string): Promise<string> {
    if (!this.summarizationConfig) {
      throw new Error('Summarization config not set');
    }
    
    // Build conversation text
    const conversationText = messages
      .map(msg => `${msg.role}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`)
      .join('\n\n');
    
    // Use custom prompt or default
    const summaryPrompt = this.summarizationConfig.summaryPrompt || 
      `Summarize the following conversation concisely, preserving all important facts, context, and information about the user. Focus on:
- User's identity (name, job, background)
- Key facts mentioned
- Topics discussed
- Important context

Conversation:
${conversationText}

Summary (2-3 paragraphs):`;

    // If previous summary exists, include it
    const fullPrompt = previousSummary 
      ? `Previous summary:\n${previousSummary}\n\n${summaryPrompt}`
      : summaryPrompt;
    
    // Use the provided model or create simple summary
    if (this.summarizationConfig.model) {
      const { generateText } = await import('ai');
      const result = await generateText({
        model: this.summarizationConfig.model,
        prompt: fullPrompt,
        maxTokens: 500,
      });
      return result.text;
    } else {
      // Simple fallback
      return this.createSimpleSummary(messages, previousSummary);
    }
  }

  private createSimpleSummary(messages: CoreMessage[], previousSummary?: string): string {
    const facts: string[] = [];
    
    messages.forEach(msg => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      
      if (content.includes("I'm") || content.includes("I am") || 
          content.includes("My name") || content.includes("I work") ||
          content.includes("I live") || content.includes("I graduated")) {
        facts.push(content);
      }
    });
    
    if (previousSummary) {
      return `${previousSummary}\n\nAdditional context: ${facts.slice(0, 5).join('. ')}`;
    }
    
    return facts.slice(0, 10).join('. ');
  }

  async clear(): Promise<void> {
    await this.getCollection().updateOne(
      { sessionId: this.id },
      {
        $set: {
          messages: [],
          metadata: {},
          updatedAt: new Date()
        }
      }
    );
  }

  async getMetadata(): Promise<Record<string, any>> {
    const session = await this.getCollection().findOne({ sessionId: this.id });
    return session?.metadata || {};
  }

  async updateMetadata(metadata: Record<string, any>): Promise<void> {
    const existingMetadata = await this.getMetadata();
    const updatedMetadata = { ...existingMetadata, ...metadata };
    
    await this.getCollection().updateOne(
      { sessionId: this.id },
      {
        $set: {
          metadata: updatedMetadata,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  }
}

// ============================================
// HYBRID SESSION (Redis + Database)
// ============================================

export interface HybridSessionConfig {
  redis: Redis;
  db: any;
  redisKeyPrefix?: string;
  redisTTL?: number;
  dbCollectionName?: string;
  maxMessages?: number;
  syncToDBInterval?: number; // Sync to DB every N messages
  summarization?: SummarizationConfig;
}

export class HybridSession<TContext = any> implements Session<TContext> {
  public readonly id: string;
  private redisSession: RedisSession<TContext>;
  private dbSession: DatabaseSession<TContext>;
  private syncToDBInterval: number;
  private messagesSinceSync: number = 0;

  constructor(id: string, config: HybridSessionConfig) {
    this.id = id;
    
    this.redisSession = new RedisSession(id, {
      redis: config.redis,
      keyPrefix: config.redisKeyPrefix,
      ttl: config.redisTTL,
      maxMessages: config.maxMessages,
      summarization: config.summarization
    });
    
    this.dbSession = new DatabaseSession(id, {
      db: config.db,
      collectionName: config.dbCollectionName,
      maxMessages: config.maxMessages,
      summarization: config.summarization
    });
    
    this.syncToDBInterval = config.syncToDBInterval || 5;
  }

  async getHistory(): Promise<CoreMessage[]> {
    // Try Redis first (fast)
    let messages = await this.redisSession.getHistory();
    
    if (messages.length === 0) {
      // Fallback to DB
      messages = await this.dbSession.getHistory();
      
      // Warm Redis cache
      if (messages.length > 0) {
        await this.redisSession.addMessages(messages);
      }
    }
    
    return messages;
  }

  async addMessages(messages: CoreMessage[]): Promise<void> {
    // Always add to Redis (fast)
    await this.redisSession.addMessages(messages);
    
    this.messagesSinceSync += messages.length;
    
    // Sync to DB periodically or if threshold reached
    if (this.messagesSinceSync >= this.syncToDBInterval) {
      await this.syncToDatabase();
    }
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.redisSession.clear(),
      this.dbSession.clear()
    ]);
    this.messagesSinceSync = 0;
  }

  async getMetadata(): Promise<Record<string, any>> {
    // Try Redis first
    let metadata = await this.redisSession.getMetadata();
    
    if (Object.keys(metadata).length === 0) {
      // Fallback to DB
      metadata = await this.dbSession.getMetadata();
      
      // Warm Redis cache
      if (Object.keys(metadata).length > 0) {
        await this.redisSession.updateMetadata(metadata);
      }
    }
    
    return metadata;
  }

  async updateMetadata(metadata: Record<string, any>): Promise<void> {
    await Promise.all([
      this.redisSession.updateMetadata(metadata),
      this.dbSession.updateMetadata(metadata)
    ]);
  }

  /**
   * Manually sync Redis cache to database
   */
  async syncToDatabase(): Promise<void> {
    const messages = await this.redisSession.getHistory();
    const metadata = await this.redisSession.getMetadata();
    
    // Clear DB session first
    await this.dbSession.clear();
    
    // Add all messages
    if (messages.length > 0) {
      await this.dbSession.addMessages(messages);
    }
    
    // Update metadata
    if (Object.keys(metadata).length > 0) {
      await this.dbSession.updateMetadata(metadata);
    }
    
    this.messagesSinceSync = 0;
  }
}

// ============================================
// SESSION MANAGER (for easy session creation)
// ============================================

export interface SummarizationConfig {
  /** Enable auto-summarization */
  enabled: boolean;
  
  /** Trigger summarization when message count exceeds this */
  messageThreshold: number; // Default: 10
  
  /** Number of recent messages to keep verbatim */
  keepRecentMessages: number; // Default: 3
  
  /** Model to use for summarization (optional, uses default if not set) */
  model?: any; // LanguageModelV1
  
  /** System prompt for summarization */
  summaryPrompt?: string;
}

export interface SessionManagerConfig {
  type: 'memory' | 'redis' | 'database' | 'hybrid';
  redis?: Redis;
  db?: any;
  redisKeyPrefix?: string;
  redisTTL?: number;
  dbCollectionName?: string;
  maxMessages?: number;
  syncToDBInterval?: number;
  
  /** Auto-summarization configuration */
  summarization?: SummarizationConfig;
}

export class SessionManager {
  private config: SessionManagerConfig;
  private sessions: Map<string, Session<any>> = new Map();

  constructor(config: SessionManagerConfig) {
    this.config = config;
  }

  /**
   * Get or create a session
   */
  getSession<TContext = any>(sessionId: string): Session<TContext> {
    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    // Create new session based on type
    let session: Session<TContext>;

    switch (this.config.type) {
      case 'memory':
        session = new MemorySession<TContext>(
          sessionId, 
          this.config.maxMessages,
          this.config.summarization
        );
        break;

      case 'redis':
        if (!this.config.redis) {
          throw new Error('Redis instance required for redis session type');
        }
        session = new RedisSession<TContext>(sessionId, {
          redis: this.config.redis,
          keyPrefix: this.config.redisKeyPrefix,
          ttl: this.config.redisTTL,
          maxMessages: this.config.maxMessages,
          summarization: this.config.summarization
        });
        break;

      case 'database':
        if (!this.config.db) {
          throw new Error('Database instance required for database session type');
        }
        session = new DatabaseSession<TContext>(sessionId, {
          db: this.config.db,
          collectionName: this.config.dbCollectionName,
          maxMessages: this.config.maxMessages,
          summarization: this.config.summarization
        });
        break;

      case 'hybrid':
        if (!this.config.redis || !this.config.db) {
          throw new Error('Both Redis and Database required for hybrid session type');
        }
        session = new HybridSession<TContext>(sessionId, {
          redis: this.config.redis,
          db: this.config.db,
          redisKeyPrefix: this.config.redisKeyPrefix,
          redisTTL: this.config.redisTTL,
          dbCollectionName: this.config.dbCollectionName,
          maxMessages: this.config.maxMessages,
          syncToDBInterval: this.config.syncToDBInterval,
          summarization: this.config.summarization
        });
        break;

      default:
        throw new Error(`Unknown session type: ${this.config.type}`);
    }

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.clear();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Clear all cached sessions (doesn't clear storage)
   */
  clearCache(): void {
    this.sessions.clear();
  }
}
