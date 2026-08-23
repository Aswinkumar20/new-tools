export interface WaveformChannel {
  id: string;
  label: string;
  samples: Float32Array;
}

export interface ParsedWaveform {
  sampleRateHz: number;
  channels: WaveformChannel[];
  durationSec: number;
  warnings: string[];
}

export interface WaveformCaliper {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  deltaTimeMs: number;
  deltaAmplitude: number;
}

export interface WaveformViewport {
  startSample: number;
  windowSamples: number;
  gain: number;
  pixelsPerSecond: number;
}

export type WaveformMontageMode = 'referential' | 'bipolar' | 'average';
