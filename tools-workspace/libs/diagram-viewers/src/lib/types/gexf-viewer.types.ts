export type GxfViewMode = 'diagram' | 'timeline' | 'communities' | 'table';
export type GxfExportFormat = 'original' | 'summary-json' | 'nodes-csv' | 'edges-csv' | 'png';
export type GxfSourceKind = 'gexf' | 'json' | 'markdown' | 'txt' | 'xml';

export interface GxfRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface GxfNode {
  id: string;
  index: number;
  label: string;
  community: string;
  start: string;
  end: string;
  size: number;
  rank: number;
  x: number;
  y: number;
}

export interface GxfEdge {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
  weight: number;
  start: string;
  end: string;
}

export interface GxfCommunity {
  id: string;
  index: number;
  name: string;
  size: number;
  nodeIds: string[];
}

export interface GxfDataset {
  name: string;
  sourceKind: GxfSourceKind;
  directed: boolean;
  mode: 'static' | 'dynamic';
  timeMin: number;
  timeMax: number;
  ticks: number[];
  nodes: GxfNode[];
  edges: GxfEdge[];
  communities: GxfCommunity[];
  warnings: string[];
}

export interface GxfLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: GxfDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface GxfMetadataRow {
  key: string;
  value: string;
}

export interface GxfSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
