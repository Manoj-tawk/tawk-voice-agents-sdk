/**
 * WebRTC Transport Layer for Server-to-Server Voice Communication
 * Supports datachannel for signaling and audio streaming
 */

import EventEmitter from 'eventemitter3';
// WebRTC imports - wrtc is optional, will try to use if available
let RTCPeerConnection: any;
let RTCDataChannel: any;
let RTCSessionDescription: any;
let RTCIceCandidate: any;

try {
  const wrtc = require('wrtc');
  RTCPeerConnection = wrtc.RTCPeerConnection;
  RTCDataChannel = wrtc.RTCDataChannel;
  RTCSessionDescription = wrtc.RTCSessionDescription;
  RTCIceCandidate = wrtc.RTCIceCandidate;
} catch (error) {
  console.warn('[WebRTC] wrtc module not available. WebRTC functionality will be disabled.');
}

export interface WebRTCServerConfig {
  iceServers?: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
  audioCodec?: 'opus' | 'pcmu' | 'pcma';
  sampleRate?: 16000 | 24000 | 48000;
  channels?: 1 | 2;
}

export interface WebRTCSignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'error';
  sdp?: string;
  candidate?: any;
  error?: string;
}

/**
 * WebRTC Server Connection
 * Handles a single peer connection for server-to-server audio streaming
 */
export class WebRTCServerConnection extends EventEmitter {
  private peerConnection: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private audioTrack: any = null;
  private config: WebRTCServerConfig;
  private sessionId: string;
  private isConnected: boolean = false;
  private audioBuffer: Buffer[] = [];

  constructor(sessionId: string, config: WebRTCServerConfig = {}) {
    super();
    this.sessionId = sessionId;
    this.config = {
      iceServers: config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
      audioCodec: config.audioCodec || 'opus',
      sampleRate: config.sampleRate || 24000,
      channels: config.channels || 1,
    };

    // Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
    });

    this.setupPeerConnection();
  }

  /**
   * Setup peer connection event handlers
   */
  private setupPeerConnection(): void {
    // ICE candidate handler
    this.peerConnection.onicecandidate = (event: any) => {
      if (event.candidate) {
        this.emit('ice-candidate', {
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    // Connection state handler
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this.emit('connection-state-change', state);

      if (state === 'connected') {
        this.isConnected = true;
        this.emit('connected');
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.isConnected = false;
        this.emit('disconnected');
      }
    };

    // ICE connection state handler
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      this.emit('ice-connection-state-change', state);
    };

    // Track handler for incoming audio
    this.peerConnection.ontrack = (event: any) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      if (event.track.kind === 'audio') {
        this.audioTrack = event.track;
        this.emit('audio-track', event.track);
      }
    };

    // Data channel handler
    this.peerConnection.ondatachannel = (event: any) => {
      console.log('[WebRTC] Received data channel:', event.channel.label);
      this.setupDataChannel(event.channel);
    };
  }

  /**
   * Setup data channel for signaling and text messages
   */
  private setupDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;

    channel.onopen = () => {
      console.log('[WebRTC] Data channel opened:', channel.label);
      this.emit('datachannel-open', channel.label);
    };

    channel.onclose = () => {
      console.log('[WebRTC] Data channel closed:', channel.label);
      this.emit('datachannel-close', channel.label);
    };

    channel.onerror = (error: any) => {
      console.error('[WebRTC] Data channel error:', error);
      this.emit('datachannel-error', error);
    };

    channel.onmessage = (event: any) => {
      try {
        // Handle binary audio data
        if (event.data instanceof ArrayBuffer || event.data instanceof Uint8Array) {
          const audioChunk = Buffer.from(event.data);
          this.emit('audio-data', audioChunk);
        } 
        // Handle JSON messages
        else if (typeof event.data === 'string') {
          const message = JSON.parse(event.data);
          this.emit('message', message);
        }
      } catch (error) {
        console.error('[WebRTC] Error processing message:', error);
      }
    };
  }

  /**
   * Create data channel for outgoing signaling
   */
  private createDataChannel(label: string = 'voice-agent'): RTCDataChannel {
    const channel = this.peerConnection.createDataChannel(label, {
      ordered: true,
    });

    this.setupDataChannel(channel);
    return channel;
  }

  /**
   * Create an offer to initiate connection
   */
  async createOffer(): Promise<WebRTCSignalingMessage> {
    try {
      // Create data channel before creating offer
      if (!this.dataChannel) {
        this.createDataChannel();
      }

      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      await this.peerConnection.setLocalDescription(offer);

      return {
        type: 'offer',
        sdp: offer.sdp,
      };
    } catch (error: any) {
      console.error('[WebRTC] Error creating offer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming offer and create answer
   */
  async handleOffer(offerSdp: string): Promise<WebRTCSignalingMessage> {
    try {
      const offer = new RTCSessionDescription({
        type: 'offer',
        sdp: offerSdp,
      });

      await this.peerConnection.setRemoteDescription(offer);

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      return {
        type: 'answer',
        sdp: answer.sdp,
      };
    } catch (error: any) {
      console.error('[WebRTC] Error handling offer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming answer
   */
  async handleAnswer(answerSdp: string): Promise<void> {
    try {
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      await this.peerConnection.setRemoteDescription(answer);
    } catch (error: any) {
      console.error('[WebRTC] Error handling answer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  async handleIceCandidate(candidate: any): Promise<void> {
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error: any) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
      throw error;
    }
  }

  /**
   * Send audio data through data channel
   */
  sendAudio(audioData: Buffer): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      // Buffer audio if not connected
      this.audioBuffer.push(audioData);
      return;
    }

    // Send buffered audio first
    if (this.audioBuffer.length > 0) {
      for (const bufferedAudio of this.audioBuffer) {
        this.dataChannel.send(new Uint8Array(bufferedAudio));
      }
      this.audioBuffer = [];
    }

    // Send current audio
    this.dataChannel.send(new Uint8Array(audioData));
  }

  /**
   * Send JSON message through data channel
   */
  sendMessage(message: any): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('[WebRTC] Data channel not ready, cannot send message');
      return;
    }

    this.dataChannel.send(JSON.stringify(message));
  }

  /**
   * Close the connection
   */
  close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.isConnected = false;
    this.audioBuffer = [];
    this.emit('closed');
  }

  /**
   * Get connection state
   */
  get connected(): boolean {
    return this.isConnected && this.peerConnection.connectionState === 'connected';
  }

  /**
   * Get session ID
   */
  get id(): string {
    return this.sessionId;
  }
}

/**
 * WebRTC Server
 * Manages multiple peer connections for server-to-server voice communication
 */
export class WebRTCServer extends EventEmitter {
  private connections: Map<string, WebRTCServerConnection> = new Map();
  private config: WebRTCServerConfig;

  constructor(config: WebRTCServerConfig = {}) {
    super();
    this.config = config;
  }

  /**
   * Create a new connection
   */
  createConnection(sessionId: string): WebRTCServerConnection {
    if (this.connections.has(sessionId)) {
      throw new Error(`Connection already exists for session: ${sessionId}`);
    }

    const connection = new WebRTCServerConnection(sessionId, this.config);

    // Forward connection events
    connection.on('connected', () => {
      this.emit('connection-connected', sessionId, connection);
    });

    connection.on('disconnected', () => {
      this.emit('connection-disconnected', sessionId);
      this.connections.delete(sessionId);
    });

    connection.on('audio-data', (audioData: Buffer) => {
      this.emit('audio-data', sessionId, audioData);
    });

    connection.on('message', (message: any) => {
      this.emit('message', sessionId, message);
    });

    connection.on('ice-candidate', (candidate: any) => {
      this.emit('ice-candidate', sessionId, candidate);
    });

    connection.on('error', (error: Error) => {
      this.emit('error', sessionId, error);
    });

    this.connections.set(sessionId, connection);
    this.emit('connection-created', sessionId, connection);

    return connection;
  }

  /**
   * Get a connection by session ID
   */
  getConnection(sessionId: string): WebRTCServerConnection | undefined {
    return this.connections.get(sessionId);
  }

  /**
   * Close a connection
   */
  closeConnection(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.close();
      this.connections.delete(sessionId);
    }
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const [sessionId, connection] of this.connections) {
      connection.close();
    }
    this.connections.clear();
  }

  /**
   * Get all active connections
   */
  getAllConnections(): WebRTCServerConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get number of active connections
   */
  get connectionCount(): number {
    return this.connections.size;
  }
}

