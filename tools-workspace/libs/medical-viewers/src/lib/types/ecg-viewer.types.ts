import type { ParsedWaveform, WaveformCaliper } from './waveform.types';

export interface EcgRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface EcgLoadedRecording {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  waveform: ParsedWaveform;
  warnings: string[];
}

export interface EcgCaliperMark extends WaveformCaliper {
  id: string;
  label: string;
}

export type EcgExportFormat = 'original' | 'summary-json' | 'calipers-json' | 'png';

export interface EcgSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

export type EcgInteractionMode = 'navigate' | 'caliper';
