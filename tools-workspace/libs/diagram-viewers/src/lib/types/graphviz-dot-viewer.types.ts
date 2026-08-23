export type GvzViewMode = 'layout' | 'graph' | 'nodes' | 'table';
export type GvzExportFormat = 'original' | 'summary-json' | 'nodes-csv' | 'edges-csv' | 'svg' | 'png';
export type GvzSourceKind = 'dot' | 'gv' | 'markdown' | 'json' | 'txt';
export type GvzLayout = 'dot' | 'neato' | 'fdp' | 'circo' | 'twopi';
export type GvzRankdir = 'TB' | 'LR' | 'BT' | 'RL';
export type GvzShape = 'box' | 'ellipse' | 'circle' | 'diamond' | 'plaintext';

export interface GvzRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface GvzNode {
  id: string;
  index: number;
  name: string;
  shape: GvzShape;
  group: string;
  x: number;
  y: number;
}

export interface GvzEdge {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
  directed: boolean;
}

export interface GvzDataset {
  name: string;
  sourceKind: GvzSourceKind;
  directed: boolean;
  layout: GvzLayout;
  rankdir: GvzRankdir;
  nodes: GvzNode[];
  edges: GvzEdge[];
  warnings: string[];
}

export interface GvzLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: GvzDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface GvzMetadataRow {
  key: string;
  value: string;
}

export interface GvzSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
