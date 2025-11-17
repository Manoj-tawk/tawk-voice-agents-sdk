/**
 * Voice Agent WebSocket Server
 * 
 * Multi-modal server that supports:
 * - Audio input → STT → agents-sdk → TTS → Audio + Text output
 * - Text input → agents-sdk → TTS → Audio + Text output
 * 
 * NOTE: This is a basic example server. For production, use the examples in /examples folder
 */

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';
import { VoiceAgent, VoiceAgentConfig } from '../voice-agent';

/**
 * Basic WebSocket Server Config
 */
export interface ServerConfig {
  port?: number;
  host?: string;
  server?: HTTPServer;
  apiKeys?: string[];
}

/**
 * Simple Voice Agent Server
 * 
 * For production usage, see examples/multi-modal-agent.ts
 */
export class VoiceAgentServer extends EventEmitter {
  private config: ServerConfig;
  private wss: WSServer;
  private sessions: Map<string, VoiceAgent> = new Map();

  constructor(config: ServerConfig = {}) {
    super();
    this.config = config;
    
    this.wss = new WSServer({
      port: config.port || 8080,
      host: config.host,
      server: config.server,
    });
    
    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private handleConnection(ws: WebSocket) {
    const sessionId = this.generateSessionId();
    
    console.log(`[${sessionId}] New connection`);
    
    // Note: You need to create voice agent with proper config
    // See examples/multi-modal-agent.ts for complete implementation
    
    ws.on('message', async (message) => {
      // Handle binary audio or JSON text
      if (message instanceof Buffer) {
        // Audio input mode
        const agent = this.sessions.get(sessionId);
        if (agent) {
          await agent.processAudio(message);
        }
      } else {
        // Text input mode
        const data = JSON.parse(message.toString());
        if (data.type === 'text') {
          const agent = this.sessions.get(sessionId);
          if (agent) {
            await agent.processText(data.text);
          }
        }
      }
    });
    
    ws.on('close', () => {
      console.log(`[${sessionId}] Connection closed`);
      const agent = this.sessions.get(sessionId);
      if (agent) {
        agent.stop();
        this.sessions.delete(sessionId);
      }
    });
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async stop() {
    for (const [sessionId, agent] of this.sessions) {
      await agent.stop();
    }
    this.sessions.clear();
    this.wss.close();
  }
}

export default VoiceAgentServer;
