export type SegyViewMode = 'section' | 'wiggle' | 'traces' | 'histogram';
export type SegyExportFormat = 'original' | 'summary-json' | 'traces-csv' | 'amplitudes-csv' | 'png';
export type SegyColormap = 'seismic' | 'grayscale' | 'viridis';
export type SegySampleFormat = 'ibm-f32' | 'i32' | 'i16' | 'ieee-f32' | 'i8' | 'unsupported';

export interface SegyRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SegySuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}

export interface SegyMetadataRow {
  key: string;
  value: string;
}

export interface SegyHistogramBar {
  label: string;
  count: number;
  heightPct: number;
  color: string;
}

export interface SegyTextCard {
  index: number;
  text: string;
}

export interface SegyTraceHeader {
  index: number;
  offset: number;
  seqLine: number;
  fieldRecord: number;
  cdp: number;
  inline: number;
  xline: number;
  sourceX: number;
  sourceY: number;
  groupX: number;
  groupY: number;
  samples: number;
  dtUs: number;
}

export interface ParsedSegy {
  textEncoding: 'ascii' | 'ebcdic';
  textHeader: string;
  cards: SegyTextCard[];
  littleEndian: boolean;
  sampleFormat: SegySampleFormat;
  formatCode: number;
  revision: string;
  dtUs: number;
  samplesPerTrace: number;
  bytesPerSample: number;
  traceCount: number;
  previewTraces: number;
  previewSamples: number;
  jobId: number;
  traces: SegyTraceHeader[];
  /** Row-major: traceCount * samplesPerTrace, preview subset only. */
  amplitudes: Float32Array;
  minAmp: number;
  maxAmp: number;
  rmsAmp: number;
  warnings: string[];
}

export interface SegyLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: ParsedSegy | null;
  warnings: string[];
  softFail: boolean;
}
