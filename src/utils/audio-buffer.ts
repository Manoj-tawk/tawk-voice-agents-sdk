/**
 * Audio buffer utility for managing audio streams
 */

import { EventEmitter } from 'events';

export class AudioBuffer extends EventEmitter {
  private buffer: Buffer;
  private maxSize: number;
  private sampleRate: number;

  constructor(maxSize: number = 10 * 16000 * 2, sampleRate: number = 16000) {
    super();
    this.buffer = Buffer.alloc(0);
    this.maxSize = maxSize;
    this.sampleRate = sampleRate;
  }

  /**
   * Write audio data to the buffer
   */
  write(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    // Trim buffer if it exceeds max size
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(this.buffer.length - this.maxSize);
    }

    this.emit('data', data);
  }

  /**
   * Read all buffered audio and clear
   */
  read(): Buffer {
    const data = this.buffer;
    this.buffer = Buffer.alloc(0);
    return data;
  }

  /**
   * Get current buffer without clearing
   */
  peek(): Buffer {
    return Buffer.from(this.buffer);
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = Buffer.alloc(0);
    this.emit('cleared');
  }

  /**
   * Get current buffer size in bytes
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Get duration of buffered audio in milliseconds
   */
  duration(): number {
    const samples = this.buffer.length / 2; // 16-bit audio
    return (samples / this.sampleRate) * 1000;
  }

  /**
   * Check if buffer has enough data for processing
   */
  hasEnoughData(durationMs: number): boolean {
    return this.duration() >= durationMs;
  }
}

/**
 * Convert Float32Array to PCM16 Buffer
 */
export function float32ToPCM16(float32Array: Float32Array): Buffer {
  const buffer = Buffer.alloc(float32Array.length * 2);
  for (let i = 0; i < float32Array.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    const int16 = sample < 0 ? sample * 32768 : sample * 32767;
    buffer.writeInt16LE(int16, i * 2);
  }
  return buffer;
}

/**
 * Convert PCM16 Buffer to Float32Array
 */
export function pcm16ToFloat32(buffer: Buffer): Float32Array {
  const float32Array = new Float32Array(buffer.length / 2);
  for (let i = 0; i < buffer.length / 2; i++) {
    const int16 = buffer.readInt16LE(i * 2);
    float32Array[i] = int16 / (int16 < 0 ? 32768 : 32767);
  }
  return float32Array;
}

/**
 * Resample audio buffer
 */
export function resampleAudio(
  input: Buffer,
  fromSampleRate: number,
  toSampleRate: number
): Buffer {
  if (fromSampleRate === toSampleRate) {
    return input;
  }

  const inputSamples = input.length / 2;
  const outputSamples = Math.floor((inputSamples * toSampleRate) / fromSampleRate);
  const output = Buffer.alloc(outputSamples * 2);

  const ratio = fromSampleRate / toSampleRate;

  for (let i = 0; i < outputSamples; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, inputSamples - 1);
    const t = srcIndex - srcIndexFloor;

    const sample1 = input.readInt16LE(srcIndexFloor * 2);
    const sample2 = input.readInt16LE(srcIndexCeil * 2);

    const interpolated = sample1 + t * (sample2 - sample1);
    output.writeInt16LE(Math.round(interpolated), i * 2);
  }

  return output;
}

