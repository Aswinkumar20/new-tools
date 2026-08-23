export type WorkflowViewMode = 'diagram' | 'nodes' | 'edges' | 'table';
export type WorkflowExportFormat = 'original' | 'summary-json' | 'nodes-csv' | 'edges-csv' | 'png';
export type WorkflowSourceKind = 'xml' | 'json' | 'csv';

export interface WorkflowRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface WorkflowNode {
  id: string;
  index: number;
  name: string;
  kind: string;
  x: number;
  y: number;
  inCount: number;
  outCount: number;
}

export interface WorkflowEdge {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
}

export interface WorkflowStat {
  name: string;
  count: number;
}

export interface WorkflowDataset {
  name: string;
  sourceKind: WorkflowSourceKind;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  kinds: WorkflowStat[];
  warnings: string[];
}

export interface WorkflowLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: WorkflowDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface WorkflowMetadataRow {
  key: string;
  value: string;
}

export interface WorkflowSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
