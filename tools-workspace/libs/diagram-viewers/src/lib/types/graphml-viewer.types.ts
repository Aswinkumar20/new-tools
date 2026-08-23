export type GmlViewMode = 'diagram' | 'layout' | 'communities' | 'table';
export type GmlExportFormat = 'original' | 'summary-json' | 'nodes-csv' | 'edges-csv' | 'png';
export type GmlSourceKind = 'graphml' | 'json' | 'markdown' | 'txt' | 'xml';

export interface GmlRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface GmlNode {
  id: string;
  index: number;
  label: string;
  community: string;
  rank: number;
  x: number;
  y: number;
}

export interface GmlEdge {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
  weight: number;
}

export interface GmlCommunity {
  id: string;
  index: number;
  name: string;
  size: number;
  nodeIds: string[];
}

export interface GmlDataset {
  name: string;
  sourceKind: GmlSourceKind;
  directed: boolean;
  nodes: GmlNode[];
  edges: GmlEdge[];
  communities: GmlCommunity[];
  warnings: string[];
}

export interface GmlLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: GmlDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface GmlMetadataRow {
  key: string;
  value: string;
}

export interface GmlSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
