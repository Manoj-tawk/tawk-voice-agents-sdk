/**
 * Voice Agent - Multi-Modal Input, Dual Output Pipeline
 * 
 * INPUT MODES:
 * 1. Audio: Audio → STT → agents-sdk (LLM) → TTS → Audio + Text
 * 2. Text:  Text → agents-sdk (LLM) → TTS → Audio + Text
 * 
 * OUTPUT: ALWAYS both Text AND Audio
 * 
 * agents-sdk IS the LLM layer - handles all agent orchestration, tools, handoffs, guardrails
 */

import { EventEmitter } from 'events';
import { Agent, run, runStream, Session } from '@tawk/voice-agents-sdk/core';
import type { LanguageModel } from 'ai';
import type {
  STTProvider,
  TTSProvider,
  VADProvider,
  Tool,
  Message,
  Metrics,
} from '../types';
import { createSTTProvider } from '../providers/stt';
import { createTTSProvider } from '../providers/tts';
import { createVADProvider } from '../providers/vad';
import { AudioBuffer } from '../utils/audio-buffer';
import { Logger } from '../utils/logger';

/**
 * Voice Agent Configuration
 * 
 * Multi-modal voice agent that supports:
 * - Audio input → STT → agents-sdk → TTS → Audio + Text output
 * - Text input → agents-sdk → TTS → Audio + Text output
 */
export interface VoiceAgentConfig {
  // Transport
  transport: {
    type: 'websocket' | 'webrtc' | 'mediasoup';
    websocket?: any;
    webrtc?: any;
    mediasoup?: any;
  };
  
  // STT Provider
  stt: {
    provider: 'deepgram' | 'assemblyai' | 'openai';
    apiKey: string;
    model?: string;
    language?: string;
    streaming?: boolean;
  };
  
  // Agent (LLM) - This IS agents-sdk
  agent: {
    model: LanguageModel;
    name?: string;
    instructions: string | ((context: any) => string);
    tools?: Record<string, any>;
    handoffs?: Agent[];
    guardrails?: any[];
    session?: Session;
    modelSettings?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    };
  };
  
  // TTS Provider
  tts: {
    provider: 'elevenlabs' | 'cartesia' | 'openai' | 'deepgram' | 'azure';
    apiKey: string;
    voiceId?: string;
    model?: string;
    streaming?: boolean;
  };
  
  // VAD (optional)
  vad?: {
    enabled: boolean;
    silenceThresholdMs?: number;
    speechThresholdMs?: number;
    sensitivity?: number;
  };
  
  // Other options
  interruption?: {
    enabled?: boolean;
    cancelOnNewInput?: boolean;
  };
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics?: boolean;
  };
}

export class VoiceAgent extends EventEmitter {
  private config: VoiceAgentConfig;
  private logger: Logger;

  // Providers
  private sttProvider: STTProvider;
  private agent: Agent; // This IS the LLM layer
  private ttsProvider: TTSProvider;
  private vadProvider: VADProvider | null = null;

  // State management
  private audioInputBuffer: AudioBuffer;
  private session?: Session;
  
  private isProcessing = false;
  private isInterrupted = false;
  private currentAudioStream: AsyncIterable<Buffer> | null = null;
  private processingTimeout: NodeJS.Timeout | null = null;
  private processingLock = false; // Prevent concurrent processing

  // Metrics
  private metrics: Metrics = {
    totalLatency: 0,
    sttLatency: 0,
    llmLatency: 0,
    ttsLatency: 0,
    turns: 0,
  };

  constructor(config: VoiceAgentConfig) {
    super();
    this.config = config;
    this.logger = new Logger(config.logging?.level || 'info', '[VoiceAgent]');

    // Initialize STT Provider
    this.sttProvider = createSTTProvider({
      provider: config.stt.provider,
      apiKey: config.stt.apiKey,
      model: config.stt.model,
      language: config.stt.language,
      streaming: config.stt.streaming,
    } as any);

    // Initialize Agent (agents-sdk IS the LLM layer)
    this.agent = new Agent({
      name: config.agent.name || 'VoiceAssistant',
      model: config.agent.model,
      instructions: config.agent.instructions,
      tools: config.agent.tools,
      handoffs: config.agent.handoffs,
      guardrails: config.agent.guardrails,
      modelSettings: config.agent.modelSettings,
    });

    // Initialize TTS Provider
    this.ttsProvider = createTTSProvider({
      provider: config.tts.provider,
      apiKey: config.tts.apiKey,
      voiceId: config.tts.voiceId,
      model: config.tts.model,
      streaming: config.tts.streaming,
    } as any);

    // Initialize VAD if enabled
    if (config.vad?.enabled !== false) {
      this.vadProvider = createVADProvider({
        enabled: true,
        silenceThresholdMs: config.vad?.silenceThresholdMs || 700,
        speechThresholdMs: config.vad?.speechThresholdMs || 300,
      });
    }

    // Initialize audio buffer
    this.audioInputBuffer = new AudioBuffer();

    // Initialize session if provided
    this.session = config.agent.session;

    this.logger.info('Voice Agent initialized', {
      stt: config.stt.provider,
      agent: config.agent.name,
      tts: config.tts.provider,
    });
  }

  /**
   * Initialize the voice agent
   */
  async initialize(): Promise<void> {
    try {
      if (this.vadProvider) {
        await this.vadProvider.start();
      }
      this.logger.info('Voice Agent ready');
      this.emit('ready');
    } catch (error) {
      this.logger.error('Failed to initialize Voice Agent', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Process incoming audio data with debouncing to handle streaming chunks
   * 
   * Flow: Audio → STT → agents-sdk (LLM) → TTS → Audio + Text output
   * 
   * Events emitted:
   * - 'processing.started'
   * - 'transcription' (text from STT)
   * - 'response.text.delta' (streaming text from LLM)
   * - 'response.text' (full text from LLM)
   * - 'audio.chunk' (audio chunks from TTS)
   * - 'tool.call' (when tools are called)
   * - 'processing.stopped'
   * 
   * Note: Uses debouncing to wait for complete audio input before processing.
   * This prevents fragmenting a single user utterance into multiple transcriptions.
   */
  async processAudio(audioData: Buffer): Promise<void> {
    try {
      // Add to buffer
      this.audioInputBuffer.write(audioData);

      // Check VAD if enabled
      if (this.vadProvider) {
        const hasVoice = await this.vadProvider.detect(audioData);
        if (!hasVoice) {
          return;
        }
      }

      // Clear existing timeout
      if (this.processingTimeout) {
        clearTimeout(this.processingTimeout);
        this.processingTimeout = null;
      }

      // Don't start new processing if already processing
      if (this.isProcessing) {
        return;
      }

      // Debounce: Wait for silence (no new chunks) before processing
      // This ensures we get the COMPLETE audio before transcribing
      this.processingTimeout = setTimeout(async () => {
        await this.processBufferedAudio();
      }, 500); // 500ms silence threshold

    } catch (error) {
      this.logger.error('Error processing audio', error);
      this.emit('error', error);
    }
  }

  /**
   * Internal method to process buffered audio
   */
  private async processBufferedAudio(): Promise<void> {
    try {
      // CRITICAL: Check processing lock to prevent concurrent execution
      if (this.processingLock) {
        return;
      }

      // Check if we have enough audio (e.g., 0.5 seconds minimum)
      if (!this.audioInputBuffer.hasEnoughData(500)) {
        return;
      }

      // Don't process if already processing
      if (this.isProcessing) {
        return;
      }

      // SET LOCK before starting
      this.processingLock = true;

      this.isProcessing = true;
      this.isInterrupted = false;
      const startTime = Date.now();

      this.emit('processing.started');

      // Get buffered audio
      const audio = this.audioInputBuffer.read();

      // Step 1: STT - Transcribe audio
      const sttStart = Date.now();
      const transcript = await this.sttProvider.transcribe(audio);
      this.metrics.sttLatency = Date.now() - sttStart;

      if (!transcript || transcript.trim().length === 0) {
        this.isProcessing = false;
        this.processingLock = false; // Release lock
        this.emit('processing.stopped');
        return;
      }

      this.logger.info('Transcription:', transcript);
      this.emit('transcription', transcript);

      // Cancel ongoing response if interruption is enabled
      if (this.config.interruption?.enabled && this.currentAudioStream) {
        await this.interrupt();
      }

      // Step 2: Run Agent (agents-sdk handles LLM, tools, handoffs, guardrails)
      await this.runAgentWithSpeech(transcript);

      // Update metrics
      this.metrics.totalLatency = Date.now() - startTime;
      this.metrics.turns++;

      if (this.config.logging?.enableMetrics) {
        this.emit('metrics', this.metrics);
        this.logger.info('Metrics:', this.metrics);
      }

      this.isProcessing = false;
      this.processingLock = false; // Release lock
      this.emit('processing.stopped');
    } catch (error) {
      this.logger.error('Error processing audio', error);
      this.emit('error', error);
      this.isProcessing = false;
      this.processingLock = false; // Release lock
      this.emit('processing.stopped');
    }
  }

  /**
   * Process text input directly (skip STT, but still produce audio + text)
   * 
   * Flow: Text → agents-sdk (LLM) → TTS → Audio + Text output
   * 
   * Events emitted:
   * - 'processing.started'
   * - 'transcription' (the input text, for consistency)
   * - 'response.text.delta' (streaming text from LLM)
   * - 'response.text' (full text from LLM)
   * - 'audio.chunk' (audio chunks from TTS) ← IMPORTANT: Audio is ALWAYS generated
   * - 'tool.call' (when tools are called)
   * - 'processing.stopped'
   * 
   * NOTE: Even with text input, audio output is ALWAYS generated via TTS
   */
  async processText(text: string): Promise<void> {
    try {
      if (!text || text.trim().length === 0) {
        return;
      }

      this.isProcessing = true;
      this.isInterrupted = false;
      const startTime = Date.now();

      this.emit('processing.started');
      
      // Emit transcription event for consistency (text input = already transcribed)
      this.emit('transcription', text);
      this.logger.info('Text input:', text);

      // Cancel ongoing response if interruption is enabled
      if (this.config.interruption?.enabled && this.currentAudioStream) {
        await this.interrupt();
      }

      // Run agent with speech synthesis (ALWAYS produces audio + text)
      await this.runAgentWithSpeech(text);

      this.metrics.totalLatency = Date.now() - startTime;
      this.metrics.sttLatency = 0; // No STT for text input
      this.metrics.turns++;

      if (this.config.logging?.enableMetrics) {
        this.emit('metrics', this.metrics);
        this.logger.info('Metrics:', this.metrics);
      }

      this.isProcessing = false;
      this.emit('processing.stopped');
    } catch (error) {
      this.logger.error('Error processing text', error);
      this.emit('error', error);
      this.isProcessing = false;
      this.emit('processing.stopped');
    }
  }

  /**
   * Run agent (agents-sdk) and synthesize speech
   * This is where agents-sdk does all the LLM work
   * 
   * CRITICAL: This method ALWAYS produces BOTH text AND audio output
   * - Text: Streamed as 'response.text.delta' and 'response.text'
   * - Audio: Generated via TTS and emitted as 'audio.chunk'
   * 
   * This ensures dual output regardless of input mode (audio or text)
   */
  private async runAgentWithSpeech(userInput: string): Promise<void> {
    const llmStart = Date.now();

    try {
      // Use agents-sdk streaming for real-time response
      const stream = await runStream(
        this.agent,
        userInput,
        {
          session: this.session,
          maxTurns: 10,
        }
      );

      let fullResponse = '';
      let currentSentence = '';

      // Stream the response
      for await (const chunk of stream.textStream) {
        if (this.isInterrupted) {
          this.logger.info('Agent response interrupted');
          break;
        }

        currentSentence += chunk;
        fullResponse += chunk;

        // Emit text delta
        this.emit('response.text.delta', chunk);
        process.stdout.write(chunk); // For debugging

        // Check for sentence boundary
        if (this.isSentenceEnd(currentSentence)) {
          const sentence = currentSentence.trim();
          this.logger.debug('Sentence complete:', sentence);

          // Start TTS for this sentence immediately (streaming)
          await this.synthesizeSentence(sentence);
          currentSentence = '';
        }
      }

      // Handle remaining text
      if (currentSentence.trim() && !this.isInterrupted) {
        await this.synthesizeSentence(currentSentence.trim());
      }

      // Get final result (includes tool calls, handoffs, etc.)
      const result = await stream.completed;

      this.metrics.llmLatency = Date.now() - llmStart;

      if (!this.isInterrupted) {
        this.emit('response.text', fullResponse);
        
        // Emit tool calls if any
        if (result.steps) {
          for (const step of result.steps) {
            if (step.toolCalls && step.toolCalls.length > 0) {
              for (const toolCall of step.toolCalls) {
                this.emit('tool.call', {
                  name: toolCall.toolName,
                  parameters: toolCall.args,
                  result: toolCall.result,
                });
              }
            }
          }
        }

        // Emit usage metrics
        if (result.metadata) {
          this.emit('usage', {
            totalTokens: result.metadata.totalTokens,
            promptTokens: result.metadata.promptTokens,
            completionTokens: result.metadata.completionTokens,
          });
          
          // Emit handoff if any
          if (result.metadata.handoffChain && result.metadata.handoffChain.length > 1) {
            this.emit('agent.handoff', {
              chain: result.metadata.handoffChain,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Error running agent', error);
      this.emit('error', error);
    }
  }

  /**
   * Synthesize a sentence to audio
   */
  private async synthesizeSentence(sentence: string): Promise<void> {
    if (!sentence || sentence.trim().length === 0) {
      return;
    }

    try {
      const ttsStart = Date.now();
      const audioStream = this.ttsProvider.synthesize(sentence);
      this.currentAudioStream = audioStream;

      this.emit('audio.started', sentence);

      for await (const audioChunk of audioStream) {
        if (this.isInterrupted) {
          this.logger.debug('TTS interrupted');
          break;
        }

        // Emit audio chunk for playback
        this.emit('audio.chunk', audioChunk);
      }

      this.metrics.ttsLatency = Date.now() - ttsStart;
      this.currentAudioStream = null;
      
      if (!this.isInterrupted) {
        this.emit('audio.ended', sentence);
      }
    } catch (error) {
      this.logger.error('Error synthesizing sentence', error);
      this.emit('error', error);
    }
  }

  /**
   * Check if text ends with sentence boundary
   */
  private isSentenceEnd(text: string): boolean {
    const trimmed = text.trim();
    return /[.!?]$/.test(trimmed) && trimmed.length > 10; // Minimum 10 chars
  }

  /**
   * Interrupt current response
   */
  async interrupt(): Promise<void> {
    this.logger.info('Interrupting current response');
    this.isInterrupted = true;
    this.currentAudioStream = null;

    // Clear any pending processing timeout
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }

    // Clear audio buffer
    this.audioInputBuffer.clear();

    this.emit('interrupted');
  }

  /**
   * Get conversation history from session
   */
  async getConversationHistory(): Promise<Message[]> {
    if (this.session) {
      const messages = await this.session.getHistory();
      return messages.map(msg => ({
        role: msg.role as any,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      }));
    }
    return [];
  }

  /**
   * Clear conversation history
   */
  async clearHistory(): Promise<void> {
    if (this.session) {
      await this.session.clear();
    }
    this.logger.info('Cleared conversation history');
    this.emit('history.cleared');
  }

  /**
   * Get current metrics
   */
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  /**
   * Get the agent (for advanced usage)
   */
  getAgent(): Agent {
    return this.agent;
  }

  /**
   * Stop the voice agent
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping Voice Agent');

      this.isInterrupted = true;
      this.isProcessing = false;

      // Clear any pending processing timeout
      if (this.processingTimeout) {
        clearTimeout(this.processingTimeout);
        this.processingTimeout = null;
      }

      // Stop all providers
      await Promise.all([
        this.sttProvider.stop(),
        this.ttsProvider.stop(),
        this.vadProvider?.stop(),
      ]);

      this.emit('stopped');
      this.logger.info('Voice Agent stopped');
    } catch (error) {
      this.logger.error('Error stopping Voice Agent', error);
      this.emit('error', error);
    }
  }
}

export default VoiceAgent;

