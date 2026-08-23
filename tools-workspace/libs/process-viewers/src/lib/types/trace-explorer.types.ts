export type TraceExplorerViewMode = 'path' | 'attributes' | 'steps' | 'table';
export type TraceExplorerExportFormat = 'original' | 'summary-json' | 'traces-csv' | 'steps-csv' | 'png';
export type TraceExplorerSourceKind = 'xes' | 'json' | 'csv';

export interface TraceExplorerRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface TraceAttributePair {
  key: string;
  value: string;
}

export interface TraceAttributeValue {
  value: string;
  count: number;
  pct: number;
}

export interface TraceAttributeStat {
  id: string;
  index: number;
  key: string;
  distinct: number;
  values: TraceAttributeValue[];
}

export interface TraceStep {
  id: string;
  index: number;
  caseId: string;
  step: number;
  activity: string;
  timestamp: string;
  timestampMs: number;
  resource: string;
  lifecycle: string;
  durationMs: number;
  attributes: TraceAttributePair[];
}

export interface TraceCase {
  id: string;
  index: number;
  caseId: string;
  path: string[];
  pathLabel: string;
  events: number;
  durationMs: number;
  startTime: string;
  endTime: string;
  resources: string[];
  attributes: TraceAttributePair[];
}

export interface TraceExplorerDataset {
  name: string;
  sourceKind: TraceExplorerSourceKind;
  traces: TraceCase[];
  steps: TraceStep[];
  attributes: TraceAttributeStat[];
  warnings: string[];
}

export interface TraceExplorerLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: TraceExplorerDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface TraceExplorerMetadataRow {
  key: string;
  value: string;
}

export interface TraceExplorerSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
