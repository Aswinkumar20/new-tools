export type CmapViewMode = 'diagram' | 'nodes' | 'links' | 'table';
export type CmapExportFormat = 'original' | 'summary-json' | 'nodes-csv' | 'links-csv' | 'png';
export type CmapSourceKind = 'cxl' | 'json' | 'markdown' | 'xml' | 'txt' | 'dot';

export interface CmapRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface CmapNode {
  id: string;
  index: number;
  label: string;
  note: string;
  x: number;
  y: number;
}

export interface CmapLink {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
}

export interface CmapDataset {
  name: string;
  sourceKind: CmapSourceKind;
  title: string;
  nodes: CmapNode[];
  links: CmapLink[];
  warnings: string[];
}

export interface CmapLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: CmapDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface CmapMetadataRow {
  key: string;
  value: string;
}

export interface CmapSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
