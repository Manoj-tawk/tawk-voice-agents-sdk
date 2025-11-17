/**
 * VAD Provider Factory
 */

import { VADProvider, VADConfig } from '../../types';
import { EnergyVADProvider } from './energy-vad';

export function createVADProvider(config: VADConfig = {
  enabled: true,
  silenceThresholdMs: 700,
  speechThresholdMs: 300,
  sensitivity: 0.5
}): VADProvider {
  // For now, we only have energy-based VAD
  // Silero VAD requires ONNX runtime which can be complex to set up
  return new EnergyVADProvider({
    sensitivity: config.sensitivity,
  });
}

export * from './energy-vad';

