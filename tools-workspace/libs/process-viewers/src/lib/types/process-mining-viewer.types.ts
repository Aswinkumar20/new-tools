export type ProcessMiningViewMode = 'variants' | 'dfg' | 'activities' | 'table';
export type ProcessMiningExportFormat = 'original' | 'summary-json' | 'variants-csv' | 'dfg-csv' | 'png';
export type ProcessMiningSourceKind = 'xes' | 'json' | 'csv';

export interface ProcessMiningRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface ProcessMiningActivity {
  id: string;
  index: number;
  name: string;
  frequency: number;
  pct: number;
  startCount: number;
  endCount: number;
  avgDurationMs: number;
}

export interface ProcessMiningDfgEdge {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  frequency: number;
  pct: number;
}

export interface ProcessMiningVariant {
  id: string;
  index: number;
  name: string;
  path: string[];
  pathLabel: string;
  cases: number;
  pct: number;
}

export interface ProcessMiningDataset {
  name: string;
  sourceKind: ProcessMiningSourceKind;
  cases: number;
  events: number;
  activities: ProcessMiningActivity[];
  dfg: ProcessMiningDfgEdge[];
  variants: ProcessMiningVariant[];
  warnings: string[];
}

export interface ProcessMiningLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: ProcessMiningDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface ProcessMiningMetadataRow {
  key: string;
  value: string;
}

export interface ProcessMiningSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
