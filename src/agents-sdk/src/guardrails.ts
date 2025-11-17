/**
 * Guardrails
 * 
 * Built-in and custom guardrails for input/output validation
 */

import type { Guardrail, GuardrailResult, RunContextWrapper } from './agent';
import { generateText } from 'ai';
import { z } from 'zod';

// ============================================
// CONTENT SAFETY GUARDRAILS
// ============================================

/**
 * Block harmful or inappropriate content
 */
export function contentSafetyGuardrail<TContext = any>(config: {
  name?: string;
  type: 'input' | 'output';
  model: any; // LanguageModel
  categories?: string[];
  threshold?: number;
}): Guardrail<TContext> {
  return {
    name: config.name || 'content_safety',
    type: config.type,
    validate: async (content: string, context: RunContextWrapper<TContext>) => {
      const categories = config.categories || [
        'hate speech',
        'violence',
        'sexual content',
        'harassment',
        'self-harm'
      ];

      const result = await generateText({
        model: config.model,
        system: `You are a content moderation system. Analyze the following text and determine if it contains any of these categories: ${categories.join(', ')}. Respond with a JSON object.`,
        prompt: content,
        tools: {
          classify: {
            description: 'Classify content safety',
            parameters: z.object({
              isSafe: z.boolean(),
              detectedCategories: z.array(z.string()),
              confidence: z.number()
            }),
            execute: async (args) => args
          }
        }
      });

      const classification = result.toolCalls?.[0]?.args;

      if (!classification || classification.isSafe) {
        return { passed: true };
      }

      return {
        passed: false,
        message: `Content contains: ${classification.detectedCategories.join(', ')}`,
        metadata: classification
      };
    }
  };
}

// ============================================
// PII DETECTION GUARDRAIL
// ============================================

/**
 * Detect and optionally block PII (Personally Identifiable Information)
 */
export function piiDetectionGuardrail<TContext = any>(config: {
  name?: string;
  type: 'input' | 'output';
  block?: boolean; // If true, block content with PII. If false, just warn
  categories?: string[];
}): Guardrail<TContext> {
  const piiPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
  };

  return {
    name: config.name || 'pii_detection',
    type: config.type,
    validate: async (content: string) => {
      const detectedPII: string[] = [];

      // Check each PII category
      for (const [category, pattern] of Object.entries(piiPatterns)) {
        if (!config.categories || config.categories.includes(category)) {
          const matches = content.match(pattern);
          if (matches) {
            detectedPII.push(category);
          }
        }
      }

      if (detectedPII.length > 0) {
        if (config.block !== false) {
          return {
            passed: false,
            message: `PII detected: ${detectedPII.join(', ')}`,
            metadata: { detectedCategories: detectedPII }
          };
        } else {
          // Just warn, don't block
          return {
            passed: true,
            message: `Warning: PII detected: ${detectedPII.join(', ')}`,
            metadata: { detectedCategories: detectedPII }
          };
        }
      }

      return { passed: true };
    }
  };
}

// ============================================
// LENGTH GUARDRAIL
// ============================================

/**
 * Ensure content meets length requirements
 */
export function lengthGuardrail<TContext = any>(config: {
  name?: string;
  type: 'input' | 'output';
  minLength?: number;
  maxLength?: number;
  unit?: 'characters' | 'words' | 'tokens';
}): Guardrail<TContext> {
  return {
    name: config.name || 'length_check',
    type: config.type,
    validate: async (content: string) => {
      let length: number;

      switch (config.unit || 'characters') {
        case 'characters':
          length = content.length;
          break;
        case 'words':
          length = content.split(/\s+/).length;
          break;
        case 'tokens':
          // Rough estimation: 1 token ≈ 4 characters
          length = Math.ceil(content.length / 4);
          break;
      }

      if (config.minLength && length < config.minLength) {
        return {
          passed: false,
          message: `Content too short: ${length} ${config.unit} (min: ${config.minLength})`
        };
      }

      if (config.maxLength && length > config.maxLength) {
        return {
          passed: false,
          message: `Content too long: ${length} ${config.unit} (max: ${config.maxLength})`
        };
      }

      return { passed: true };
    }
  };
}

// ============================================
// TOPIC RELEVANCE GUARDRAIL
// ============================================

/**
 * Ensure content is relevant to allowed topics
 */
export function topicRelevanceGuardrail<TContext = any>(config: {
  name?: string;
  type: 'input' | 'output';
  model: any;
  allowedTopics: string[];
  threshold?: number;
}): Guardrail<TContext> {
  return {
    name: config.name || 'topic_relevance',
    type: config.type,
    validate: async (content: string) => {
      const result = await generateText({
        model: config.model,
        system: `Analyze if the following text is relevant to these topics: ${config.allowedTopics.join(', ')}. Rate relevance from 0-10.`,
        prompt: content,
        tools: {
          rate_relevance: {
            description: 'Rate topic relevance',
            parameters: z.object({
              isRelevant: z.boolean(),
              relevanceScore: z.number(),
              matchedTopics: z.array(z.string()),
              reasoning: z.string()
            }),
            execute: async (args) => args
          }
        }
      });

      const rating = result.toolCalls?.[0]?.args;
      const threshold = config.threshold || 5;

      if (!rating || !rating.isRelevant || rating.relevanceScore < threshold) {
        return {
          passed: false,
          message: `Content not relevant to allowed topics. Score: ${rating?.relevanceScore || 0}`,
          metadata: rating
        };
      }

      return { passed: true, metadata: rating };
    }
  };
}

// ============================================
// FORMAT VALIDATION GUARDRAIL
// ============================================

/**
 * Validate content format (JSON, XML, etc.)
 */
export function formatValidationGuardrail<TContext = any>(config: {
  name?: string;
  type: 'input' | 'output';
  format: 'json' | 'xml' | 'yaml' | 'markdown';
  schema?: z.ZodSchema;
}): Guardrail<TContext> {
  return {
    name: config.name || 'format_validation',
    type: config.type,
    validate: async (content: string) => {
      try {
        switch (config.format) {
          case 'json':
            const parsed = JSON.parse(content);
            if (config.schema) {
              config.schema.parse(parsed);
            }
            break;

          case 'xml':
            // Simple XML validation
            if (!content.trim().startsWith('<') || !content.trim().endsWith('>')) {
              throw new Error('Invalid XML format');
            }
            break;

          case 'yaml':
            // Would need yaml parser
            throw new Error('YAML validation not implemented');

          case 'markdown':
            // Basic markdown check
            if (!content.includes('#') && !content.includes('*') && !content.includes('[')) {
              throw new Error('Content does not appear to be markdown');
            }
            break;
        }

        return { passed: true };
      } catch (error: any) {
        return {
          passed: false,
          message: `Format validation failed: ${error?.message || 'Unknown error'}`
        };
      }
    }
  };
}

// ============================================
// CUSTOM FUNCTION GUARDRAIL
// ============================================

/**
 * Create a custom guardrail with a validation function
 */
export function customGuardrail<TContext = any>(config: {
  name: string;
  type: 'input' | 'output';
  validate: (content: string, context: RunContextWrapper<TContext>) => Promise<GuardrailResult> | GuardrailResult;
}): Guardrail<TContext> {
  return {
    name: config.name,
    type: config.type,
    validate: config.validate
  };
}

// ============================================
// RATE LIMITING GUARDRAIL
// ============================================

/**
 * Rate limit based on user/session
 */
export function rateLimitGuardrail<TContext = any>(config: {
  name?: string;
  storage: Map<string, { count: number; resetAt: number }>;
  maxRequests: number;
  windowMs: number;
  keyExtractor: (context: RunContextWrapper<TContext>) => string;
}): Guardrail<TContext> {
  return {
    name: config.name || 'rate_limit',
    type: 'input',
    validate: async (content: string, context: RunContextWrapper<TContext>) => {
      const key = config.keyExtractor(context);
      const now = Date.now();

      let entry = config.storage.get(key);

      if (!entry || now > entry.resetAt) {
        entry = {
          count: 0,
          resetAt: now + config.windowMs
        };
      }

      entry.count++;
      config.storage.set(key, entry);

      if (entry.count > config.maxRequests) {
        const resetIn = Math.ceil((entry.resetAt - now) / 1000);
        return {
          passed: false,
          message: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
          metadata: {
            count: entry.count,
            limit: config.maxRequests,
            resetIn
          }
        };
      }

      return { passed: true };
    }
  };
}

// ============================================
// LANGUAGE DETECTION GUARDRAIL
// ============================================

/**
 * Ensure content is in allowed language(s)
 */
export function languageGuardrail<TContext = any>(config: {
  name?: string;
  type: 'input' | 'output';
  model: any;
  allowedLanguages: string[];
}): Guardrail<TContext> {
  return {
    name: config.name || 'language_detection',
    type: config.type,
    validate: async (content: string) => {
      const result = await generateText({
        model: config.model,
        system: 'Detect the language of the text. Respond with the ISO 639-1 language code.',
        prompt: content,
        tools: {
          detect_language: {
            description: 'Detect language',
            parameters: z.object({
              language: z.string(),
              confidence: z.number()
            }),
            execute: async (args) => args
          }
        }
      });

      const detection = result.toolCalls?.[0]?.args;

      if (!detection || !config.allowedLanguages.includes(detection.language)) {
        return {
          passed: false,
          message: `Language not allowed: ${detection?.language}. Allowed: ${config.allowedLanguages.join(', ')}`,
          metadata: detection
        };
      }

      return { passed: true, metadata: detection };
    }
  };
}

// ============================================
// SENTIMENT GUARDRAIL
// ============================================

/**
 * Block content with certain sentiment
 */
export function sentimentGuardrail<TContext = any>(config: {
  name?: string;
  type: 'input' | 'output';
  model: any;
  blockedSentiments?: ('positive' | 'negative' | 'neutral')[];
  allowedSentiments?: ('positive' | 'negative' | 'neutral')[];
}): Guardrail<TContext> {
  return {
    name: config.name || 'sentiment_check',
    type: config.type,
    validate: async (content: string) => {
      const result = await generateText({
        model: config.model,
        system: 'Analyze the sentiment of the text as positive, negative, or neutral.',
        prompt: content,
        tools: {
          analyze_sentiment: {
            description: 'Analyze sentiment',
            parameters: z.object({
              sentiment: z.enum(['positive', 'negative', 'neutral']),
              confidence: z.number(),
              reasoning: z.string()
            }),
            execute: async (args) => args
          }
        }
      });

      const sentiment = result.toolCalls?.[0]?.args;

      if (config.blockedSentiments?.includes(sentiment.sentiment)) {
        return {
          passed: false,
          message: `Sentiment not allowed: ${sentiment.sentiment}`,
          metadata: sentiment
        };
      }

      if (config.allowedSentiments && !config.allowedSentiments.includes(sentiment.sentiment)) {
        return {
          passed: false,
          message: `Sentiment not in allowed list: ${sentiment.sentiment}`,
          metadata: sentiment
        };
      }

      return { passed: true, metadata: sentiment };
    }
  };
}

// ============================================
// TOXICITY GUARDRAIL
// ============================================

/**
 * Detect and block toxic content
 */
export function toxicityGuardrail<TContext = any>(config: {
  name?: string;
  type: 'input' | 'output';
  model: any;
  threshold?: number; // 0-10 scale
}): Guardrail<TContext> {
  return {
    name: config.name || 'toxicity_check',
    type: config.type,
    validate: async (content: string) => {
      const result = await generateText({
        model: config.model,
        system: 'Rate the toxicity of the text on a scale from 0 (not toxic) to 10 (extremely toxic).',
        prompt: content,
        tools: {
          rate_toxicity: {
            description: 'Rate toxicity',
            parameters: z.object({
              toxicityScore: z.number(),
              categories: z.array(z.string()),
              explanation: z.string()
            }),
            execute: async (args) => args
          }
        }
      });

      const rating = result.toolCalls?.[0]?.args;
      const threshold = config.threshold || 5;

      if (rating && rating.toxicityScore > threshold) {
        return {
          passed: false,
          message: `Content toxicity too high: ${rating.toxicityScore} (threshold: ${threshold})`,
          metadata: rating
        };
      }

      return { passed: true, metadata: rating };
    }
  };
}

// ============================================
// EXPORT ALL GUARDRAILS
// ============================================

export const guardrails = {
  contentSafety: contentSafetyGuardrail,
  piiDetection: piiDetectionGuardrail,
  length: lengthGuardrail,
  topicRelevance: topicRelevanceGuardrail,
  formatValidation: formatValidationGuardrail,
  custom: customGuardrail,
  rateLimit: rateLimitGuardrail,
  language: languageGuardrail,
  sentiment: sentimentGuardrail,
  toxicity: toxicityGuardrail
};
