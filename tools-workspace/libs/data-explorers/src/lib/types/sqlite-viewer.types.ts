export type SqViewMode = 'tables' | 'schema' | 'preview' | 'table';
export type SqExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type SqSourceKind = 'sqlite' | 'sql' | 'json' | 'csv' | 'markdown' | 'txt';

export interface SqRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SqColumn {
  id: string;
  index: number;
  name: string;
  type: string;
  nullable: boolean;
  pk: boolean;
}

export interface SqTable {
  id: string;
  index: number;
  name: string;
  sql: string;
  numRows: number;
  columns: SqColumn[];
  rows: Array<Record<string, string>>;
}

export interface SqDataset {
  name: string;
  sourceKind: SqSourceKind;
  title: string;
  pageSize: number;
  encoding: string;
  pageCount: number;
  tables: SqTable[];
  warnings: string[];
}

export interface SqLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: SqDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface SqMetadataRow {
  key: string;
  value: string;
}

export interface SqSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
