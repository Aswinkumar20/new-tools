export type DkViewMode = 'tables' | 'schema' | 'preview' | 'table';
export type DkExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type DkSourceKind = 'duckdb' | 'sql' | 'json' | 'csv' | 'markdown' | 'txt';

export interface DkRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DkColumn {
  id: string;
  index: number;
  name: string;
  type: string;
  nullable: boolean;
}

export interface DkTable {
  id: string;
  index: number;
  name: string;
  sql: string;
  numRows: number;
  columns: DkColumn[];
  rows: Array<Record<string, string>>;
}

export interface DkDataset {
  name: string;
  sourceKind: DkSourceKind;
  title: string;
  storageVersion: string;
  tables: DkTable[];
  warnings: string[];
}

export interface DkLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: DkDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface DkMetadataRow {
  key: string;
  value: string;
}

export interface DkSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
