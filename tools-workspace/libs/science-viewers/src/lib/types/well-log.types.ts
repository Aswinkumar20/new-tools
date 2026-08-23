export interface WellLogHeaderRow {
  mnemonic: string;
  unit: string;
  value: string;
  description: string;
}

export interface WellLogCurve {
  mnemonic: string;
  unit: string;
  description: string;
  values: number[];
  min: number;
  max: number;
  mean: number;
  nullCount: number;
  logScale?: boolean;
  reversed?: boolean;
}

export interface WellLogTrackOptions {
  depthMin: number;
  depthMax: number;
  selectedMnemonic: string | null;
  background?: string;
}

export interface WellLogRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface WellLogSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}

export interface WellLogMetadataRow {
  key: string;
  value: string;
}

export interface WellLogHistogramBar {
  label: string;
  count: number;
  heightPct: number;
  color: string;
}
