export type ProcessMapViewMode = 'variants' | 'frequencies' | 'map' | 'table';
export type ProcessMapExportFormat = 'original' | 'summary-json' | 'variants-csv' | 'flows-csv' | 'png';
export type ProcessMapSourceKind = 'json' | 'xml' | 'csv';

export interface ProcessMapRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface ProcessMapActivity {
  id: string;
  index: number;
  name: string;
  frequency: number;
  pct: number;
  avgDurationMs: number;
}

export interface ProcessMapFlow {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  frequency: number;
  pct: number;
}

export interface ProcessMapVariant {
  id: string;
  index: number;
  name: string;
  path: string[];
  pathLabel: string;
  cases: number;
  pct: number;
}

export interface ProcessMapDataset {
  name: string;
  sourceKind: ProcessMapSourceKind;
  cases: number;
  activities: ProcessMapActivity[];
  flows: ProcessMapFlow[];
  variants: ProcessMapVariant[];
  warnings: string[];
}

export interface ProcessMapLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: ProcessMapDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface ProcessMapMetadataRow {
  key: string;
  value: string;
}

export interface ProcessMapSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
