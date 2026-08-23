export type TfViewMode = 'diagram' | 'resources' | 'edges' | 'table';
export type TfExportFormat = 'original' | 'summary-json' | 'resources-csv' | 'edges-csv' | 'png';
export type TfSourceKind = 'dot' | 'tfgraph' | 'json' | 'xml' | 'markdown' | 'txt';

export interface TfRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface TfResource {
  id: string;
  index: number;
  name: string;
  type: string;
  provider: string;
  x: number;
  y: number;
}

export interface TfEdge {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
}

export interface TfDataset {
  name: string;
  sourceKind: TfSourceKind;
  title: string;
  resources: TfResource[];
  edges: TfEdge[];
  warnings: string[];
}

export interface TfLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: TfDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface TfMetadataRow {
  key: string;
  value: string;
}

export interface TfSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
