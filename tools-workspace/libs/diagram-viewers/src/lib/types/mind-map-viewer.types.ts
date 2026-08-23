export type MmapViewMode = 'diagram' | 'outline' | 'table';
export type MmapExportFormat = 'original' | 'summary-json' | 'nodes-csv' | 'outline-txt' | 'png';
export type MmapSourceKind = 'markdown' | 'mermaid' | 'opml' | 'json' | 'txt' | 'xml';

export interface MmapRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface MmapNode {
  id: string;
  index: number;
  label: string;
  note: string;
  depth: number;
  parentId: string;
  childIds: string[];
  collapsed: boolean;
  x: number;
  y: number;
}

export interface MmapDataset {
  name: string;
  sourceKind: MmapSourceKind;
  rootId: string;
  nodes: MmapNode[];
  warnings: string[];
}

export interface MmapLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: MmapDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface MmapMetadataRow {
  key: string;
  value: string;
}

export interface MmapSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
