export type SiemViewMode = 'events' | 'correlate' | 'severity' | 'table';
export type SiemExportFormat = 'original' | 'summary-json' | 'events-csv' | 'correlations-csv' | 'png';
export type SiemSourceKind = 'json' | 'csv' | 'cef' | 'log';

export interface SiemRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SiemEvent {
  id: string;
  index: number;
  time: string;
  relMs: number;
  severity: string;
  rule: string;
  ruleId: string;
  host: string;
  user: string;
  src: string;
  dst: string;
  tactic: string;
  technique: string;
  message: string;
  count: number;
}

export interface SiemCorrelation {
  id: string;
  key: string;
  label: string;
  events: number;
  severity: string;
  firstMs: number;
  lastMs: number;
  hosts: string[];
  srcs: string[];
  rules: string[];
}

export interface SiemSeverityStat {
  name: string;
  count: number;
}

export interface SiemDataset {
  name: string;
  sourceKind: SiemSourceKind;
  events: SiemEvent[];
  correlations: SiemCorrelation[];
  severities: SiemSeverityStat[];
  durationMs: number;
  warnings: string[];
}

export interface SiemLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: SiemDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface SiemMetadataRow {
  key: string;
  value: string;
}

export interface SiemSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
