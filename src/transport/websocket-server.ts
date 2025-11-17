/**
 * WebSocket Transport Layer for Voice Communication
 * Handles WebSocket connections with enhanced event system
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { ClientMessage, VoiceAgentEvent } from '../types/events';

export interface WebSocketServerConfig {
  port?: number;
  host?: string;
  path?: string;
  apiKeys?: string[];
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
  maxPayload?: number;
  heartbeatInterval?: number;
}

/**
 * WebSocket Connection
 * Manages a single WebSocket connection
 */
export class WebSocketConnection extends EventEmitter {
  private ws: WebSocket;
  private sessionId: string;
  private isAlive: boolean = true;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(ws: WebSocket, sessionId: string, heartbeatInterval: number = 30000) {
    super();
    this.ws = ws;
    this.sessionId = sessionId;

    this.setupHandlers();
    this.startHeartbeat(heartbeatInterval);
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupHandlers(): void {
    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data);
    });

    this.ws.on('pong', () => {
      this.isAlive = true;
    });

    this.ws.on('close', (code: number, reason: string) => {
      this.cleanup();
      this.emit('close', code, reason);
    });

    this.ws.on('error', (error: Error) => {
      console.error(`[WebSocket] Error for session ${this.sessionId}:`, error);
      this.emit('error', error);
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      // Handle binary audio data
      if (Buffer.isBuffer(data)) {
        this.emit('audio-data', data);
        return;
      }

      // Handle JSON messages
      if (typeof data === 'string') {
        const message = JSON.parse(data) as ClientMessage;
        this.emit('message', message);
        return;
      }

      // Handle ArrayBuffer
      if (data instanceof ArrayBuffer) {
        this.emit('audio-data', Buffer.from(data));
        return;
      }

      // Handle Array of buffers
      if (Array.isArray(data)) {
        const buffer = Buffer.concat(data);
        this.emit('audio-data', buffer);
        return;
      }
    } catch (error) {
      console.error(`[WebSocket] Error parsing message:`, error);
      this.sendError('parse_error', 'Failed to parse message');
    }
  }

  /**
   * Send an event to the client
   */
  sendEvent(event: VoiceAgentEvent): void {
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WebSocket] Cannot send event, connection not open`);
      return;
    }

    try {
      this.ws.send(JSON.stringify(event));
    } catch (error) {
      console.error(`[WebSocket] Error sending event:`, error);
    }
  }

  /**
   * Send audio data to the client
   */
  sendAudio(audioData: Buffer): void {
    if (this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.ws.send(audioData);
    } catch (error) {
      console.error(`[WebSocket] Error sending audio:`, error);
    }
  }

  /**
   * Send error message
   */
  sendError(code: string, message: string): void {
    const errorEvent: VoiceAgentEvent = {
      type: 'error',
      event_id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      error: {
        type: 'server_error',
        code,
        message,
      },
    };
    this.sendEvent(errorEvent);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(interval: number): void {
    this.heartbeatTimer = setInterval(() => {
      if (!this.isAlive) {
        console.log(`[WebSocket] Terminating inactive connection: ${this.sessionId}`);
        this.terminate();
        return;
      }

      this.isAlive = false;
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, interval);
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Close the connection gracefully
   */
  close(code: number = 1000, reason: string = 'Normal closure'): void {
    this.cleanup();
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close(code, reason);
    }
  }

  /**
   * Terminate the connection immediately
   */
  terminate(): void {
    this.cleanup();
    this.ws.terminate();
  }

  /**
   * Check if connection is open
   */
  get isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get session ID
   */
  get id(): string {
    return this.sessionId;
  }
}

/**
 * WebSocket Server
 * Manages multiple WebSocket connections
 */
export class WebSocketServer extends EventEmitter {
  private wss: WebSocket.Server;
  private connections: Map<string, WebSocketConnection> = new Map();
  private config: WebSocketServerConfig;

  constructor(config: WebSocketServerConfig = {}) {
    super();
    this.config = {
      port: config.port || 8080,
      host: config.host || '0.0.0.0',
      path: config.path || '/v1/realtime',
      apiKeys: config.apiKeys || [],
      maxPayload: config.maxPayload || 100 * 1024 * 1024, // 100MB
      heartbeatInterval: config.heartbeatInterval || 30000,
      ...config,
    };

    this.wss = new WebSocket.Server({
      port: this.config.port,
      host: this.config.host,
      path: this.config.path,
      maxPayload: this.config.maxPayload,
    });

    this.setupServer();
  }

  /**
   * Setup WebSocket server event handlers
   */
  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, request: any) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error: Error) => {
      console.error('[WebSocket Server] Error:', error);
      this.emit('error', error);
    });

    console.log(`[WebSocket Server] Listening on ${this.config.host}:${this.config.port}${this.config.path}`);
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: any): void {
    // Validate API key if configured
    if (this.config.apiKeys && this.config.apiKeys.length > 0) {
      const apiKey = this.extractApiKey(request);
      if (!apiKey || !this.config.apiKeys.includes(apiKey)) {
        ws.close(4001, 'Unauthorized');
        return;
      }
    }

    // Generate session ID
    const sessionId = this.generateSessionId();

    // Create connection wrapper
    const connection = new WebSocketConnection(
      ws,
      sessionId,
      this.config.heartbeatInterval
    );

    // Forward connection events
    connection.on('message', (message: ClientMessage) => {
      this.emit('message', sessionId, message, connection);
    });

    connection.on('audio-data', (audioData: Buffer) => {
      this.emit('audio-data', sessionId, audioData, connection);
    });

    connection.on('close', (code: number, reason: string) => {
      console.log(`[WebSocket] Connection closed: ${sessionId} (${code}: ${reason})`);
      this.connections.delete(sessionId);
      this.emit('disconnection', sessionId);
    });

    connection.on('error', (error: Error) => {
      this.emit('connection-error', sessionId, error);
    });

    // Store connection
    this.connections.set(sessionId, connection);

    // Emit connection event
    this.emit('connection', sessionId, connection);

    console.log(`[WebSocket] New connection: ${sessionId}`);
  }

  /**
   * Extract API key from request
   */
  private extractApiKey(request: any): string | null {
    // Check Authorization header
    const authHeader = request.headers?.authorization;
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match) {
        return match[1];
      }
    }

    // Check query parameter
    const url = new URL(request.url || '', `http://${request.headers?.host || 'localhost'}`);
    return url.searchParams.get('api_key');
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get a connection by session ID
   */
  getConnection(sessionId: string): WebSocketConnection | undefined {
    return this.connections.get(sessionId);
  }

  /**
   * Close a connection
   */
  closeConnection(sessionId: string, code: number = 1000, reason: string = 'Normal closure'): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.close(code, reason);
      this.connections.delete(sessionId);
    }
  }

  /**
   * Broadcast event to all connections
   */
  broadcast(event: VoiceAgentEvent): void {
    for (const connection of this.connections.values()) {
      connection.sendEvent(event);
    }
  }

  /**
   * Close all connections and stop server
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Close all connections
      for (const connection of this.connections.values()) {
        connection.close();
      }
      this.connections.clear();

      // Close server
      this.wss.close((error) => {
        if (error) {
          reject(error);
        } else {
          console.log('[WebSocket Server] Closed');
          resolve();
        }
      });
    });
  }

  /**
   * Get all active connections
   */
  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get number of active connections
   */
  get connectionCount(): number {
    return this.connections.size;
  }
}
