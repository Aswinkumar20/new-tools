import type { ParsedWaveform, WaveformCaliper, WaveformMontageMode } from './waveform.types';

export interface EegRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface EegLoadedRecording {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  waveform: ParsedWaveform;
  warnings: string[];
}

export interface EegCaliperMark extends WaveformCaliper {
  id: string;
  label: string;
}

export type EegExportFormat = 'original' | 'summary-json' | 'visible-json' | 'calipers-json' | 'png';

export type EegInteractionMode = 'navigate' | 'caliper';

export interface EegSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

export interface EegMontagePreset {
  id: WaveformMontageMode;
  label: string;
  description: string;
}
