export type XmViewMode = 'nodes' | 'attributes' | 'preview' | 'table';
export type XmExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type XmSourceKind = 'xml' | 'json' | 'csv' | 'markdown' | 'txt';

export interface XmRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface XmNode {
  id: string;
  index: number;
  name: string;
  path: string;
  text: string;
  depth: number;
  childCount: number;
  attrCount: number;
}

export interface XmAttribute {
  id: string;
  index: number;
  owner: string;
  ownerName: string;
  name: string;
  value: string;
}

export interface XmSchemaEntry {
  id: string;
  index: number;
  path: string;
  name: string;
  attrCount: number;
  childCount: number;
  sample: string;
}

export interface XmColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface XmDataset {
  name: string;
  sourceKind: XmSourceKind;
  title: string;
  encoding: string;
  rootName: string;
  nodeCount: number;
  attrCount: number;
  maxDepth: number;
  nodes: XmNode[];
  attributes: XmAttribute[];
  schema: XmSchemaEntry[];
  columns: XmColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface XmLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: XmDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface XmMetadataRow {
  key: string;
  value: string;
}

export interface XmSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
