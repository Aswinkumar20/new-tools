export type FpViewMode = 'diagram' | 'nodes' | 'icons' | 'table';
export type FpExportFormat = 'original' | 'summary-json' | 'nodes-csv' | 'icons-csv' | 'png';
export type FpSourceKind = 'mm' | 'json' | 'markdown' | 'txt' | 'xml';

export interface FpRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface FpAttribute {
  name: string;
  value: string;
}

export interface FpNode {
  id: string;
  index: number;
  label: string;
  note: string;
  icons: string[];
  attributes: FpAttribute[];
  color: string;
  depth: number;
  parentId: string;
  childIds: string[];
  collapsed: boolean;
  x: number;
  y: number;
}

export interface FpIconGroup {
  id: string;
  index: number;
  name: string;
  count: number;
  nodeIds: string[];
}

export interface FpDataset {
  name: string;
  sourceKind: FpSourceKind;
  version: string;
  rootId: string;
  nodes: FpNode[];
  icons: FpIconGroup[];
  warnings: string[];
}

export interface FpLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: FpDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface FpMetadataRow {
  key: string;
  value: string;
}

export interface FpSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
