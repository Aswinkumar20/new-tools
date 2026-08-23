export type YlViewMode = 'tree' | 'validate' | 'preview' | 'table';
export type YlExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type YlSourceKind = 'yaml' | 'json' | 'csv' | 'markdown' | 'txt';
export type YlValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
export type YlIssueSeverity = 'error' | 'warning';

export interface YlRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface YlNode {
  id: string;
  index: number;
  name: string;
  path: string;
  type: YlValueType;
  value: string;
  depth: number;
  parentId: string | null;
  childCount: number;
}

export interface YlIssue {
  id: string;
  index: number;
  severity: YlIssueSeverity;
  code: string;
  message: string;
  line: number;
  path: string;
}

export interface YlSchemaEntry {
  id: string;
  index: number;
  path: string;
  name: string;
  type: string;
  nullable: boolean;
  childCount: number;
  sample: string;
}

export interface YlColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface YlDataset {
  name: string;
  sourceKind: YlSourceKind;
  title: string;
  encoding: string;
  rootType: YlValueType;
  nodeCount: number;
  maxDepth: number;
  valid: boolean;
  nodes: YlNode[];
  issues: YlIssue[];
  schema: YlSchemaEntry[];
  columns: YlColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface YlLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: YlDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface YlMetadataRow {
  key: string;
  value: string;
}

export interface YlSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
