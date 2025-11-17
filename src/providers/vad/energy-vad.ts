/**
 * Energy-based Voice Activity Detection
 * Simple VAD implementation based on audio energy levels
 */

import { VADProvider } from '../../types';

export class EnergyVADProvider implements VADProvider {
  private threshold: number;
  private isStarted: boolean = false;

  constructor(config: { threshold?: number; sensitivity?: number } = {}) {
    // Threshold for voice detection (0-1)
    this.threshold = config.threshold ?? config.sensitivity ?? 0.02;
  }

  async start(): Promise<void> {
    this.isStarted = true;
  }

  async detect(audio: Buffer): Promise<boolean> {
    if (!this.isStarted) {
      return false;
    }

    // Calculate RMS (Root Mean Square) energy
    const energy = this.calculateEnergy(audio);

    // Voice detected if energy exceeds threshold
    return energy > this.threshold;
  }

  async stop(): Promise<void> {
    this.isStarted = false;
  }

  private calculateEnergy(audio: Buffer): number {
    let sum = 0;
    const samples = audio.length / 2; // 16-bit audio

    for (let i = 0; i < audio.length; i += 2) {
      const sample = audio.readInt16LE(i) / 32768; // Normalize to -1 to 1
      sum += sample * sample;
    }

    const rms = Math.sqrt(sum / samples);
    return rms;
  }

  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }
}

