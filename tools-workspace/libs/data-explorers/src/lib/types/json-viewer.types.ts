export type JnViewMode = 'tree' | 'schema' | 'preview' | 'table';
export type JnExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type JnSourceKind = 'json' | 'jsonl' | 'csv' | 'markdown' | 'txt';
export type JnValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface JnRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface JnNode {
  id: string;
  index: number;
  name: string;
  path: string;
  type: JnValueType;
  value: string;
  depth: number;
  parentId: string | null;
  childCount: number;
}

export interface JnSchemaEntry {
  id: string;
  index: number;
  path: string;
  name: string;
  type: string;
  nullable: boolean;
  childCount: number;
  sample: string;
}

export interface JnColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface JnDataset {
  name: string;
  sourceKind: JnSourceKind;
  title: string;
  encoding: string;
  rootType: JnValueType;
  nodeCount: number;
  maxDepth: number;
  nodes: JnNode[];
  schema: JnSchemaEntry[];
  columns: JnColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface JnLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: JnDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface JnMetadataRow {
  key: string;
  value: string;
}

export interface JnSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
