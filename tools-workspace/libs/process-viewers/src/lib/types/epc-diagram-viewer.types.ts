export type EpcViewMode = 'diagram' | 'events' | 'functions' | 'table';
export type EpcExportFormat = 'original' | 'summary-json' | 'events-csv' | 'flows-csv' | 'png';
export type EpcSourceKind = 'epc' | 'json' | 'csv';

export interface EpcRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface EpcNode {
  id: string;
  index: number;
  name: string;
  kind: string;
  x: number;
  y: number;
  inCount: number;
  outCount: number;
}

export interface EpcFlow {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
}

export interface EpcStat {
  name: string;
  count: number;
}

export interface EpcDataset {
  name: string;
  sourceKind: EpcSourceKind;
  nodes: EpcNode[];
  events: EpcNode[];
  functions: EpcNode[];
  connectors: EpcNode[];
  flows: EpcFlow[];
  kinds: EpcStat[];
  warnings: string[];
}

export interface EpcLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: EpcDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface EpcMetadataRow {
  key: string;
  value: string;
}

export interface EpcSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
