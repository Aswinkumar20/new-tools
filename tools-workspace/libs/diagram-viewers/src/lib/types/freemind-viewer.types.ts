export type FmViewMode = 'diagram' | 'tree' | 'notes' | 'table';
export type FmExportFormat = 'original' | 'summary-json' | 'nodes-csv' | 'notes-txt' | 'png';
export type FmSourceKind = 'mm' | 'json' | 'markdown' | 'txt' | 'xml';

export interface FmRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface FmNode {
  id: string;
  index: number;
  label: string;
  note: string;
  position: string;
  depth: number;
  parentId: string;
  childIds: string[];
  collapsed: boolean;
  x: number;
  y: number;
}

export interface FmDataset {
  name: string;
  sourceKind: FmSourceKind;
  version: string;
  rootId: string;
  nodes: FmNode[];
  warnings: string[];
}

export interface FmLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: FmDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface FmMetadataRow {
  key: string;
  value: string;
}

export interface FmSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
