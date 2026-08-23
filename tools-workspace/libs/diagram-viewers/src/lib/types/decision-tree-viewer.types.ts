export type DtViewMode = 'diagram' | 'branches' | 'leaves' | 'table';
export type DtExportFormat = 'original' | 'summary-json' | 'branches-csv' | 'leaves-csv' | 'png';
export type DtSourceKind = 'json' | 'xml' | 'csv' | 'markdown' | 'txt';
export type DtNodeKind = 'root' | 'branch' | 'leaf';

export interface DtRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DtNode {
  id: string;
  index: number;
  name: string;
  kind: DtNodeKind;
  feature: string;
  operator: string;
  threshold: string;
  value: string;
  samples: string;
  x: number;
  y: number;
  depth: number;
}

export interface DtEdge {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
}

export interface DtDataset {
  name: string;
  sourceKind: DtSourceKind;
  title: string;
  root: string;
  nodes: DtNode[];
  branches: DtNode[];
  leaves: DtNode[];
  edges: DtEdge[];
  warnings: string[];
}

export interface DtLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: DtDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface DtMetadataRow {
  key: string;
  value: string;
}

export interface DtSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
