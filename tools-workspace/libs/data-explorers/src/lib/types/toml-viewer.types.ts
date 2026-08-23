export type TmViewMode = 'tables' | 'keys' | 'preview' | 'table';
export type TmExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type TmSourceKind = 'toml' | 'json' | 'csv' | 'markdown' | 'txt';
export type TmTableKind = 'root' | 'table' | 'array-table';

export interface TmRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface TmKey {
  id: string;
  index: number;
  name: string;
  path: string;
  type: string;
  value: string;
  table: string;
}

export interface TmTable {
  id: string;
  index: number;
  name: string;
  path: string;
  kind: TmTableKind;
  keyCount: number;
  numRows: number;
  keys: TmKey[];
  rows: Array<Record<string, string>>;
}

export interface TmColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface TmDataset {
  name: string;
  sourceKind: TmSourceKind;
  title: string;
  encoding: string;
  tableCount: number;
  keyCount: number;
  tables: TmTable[];
  keys: TmKey[];
  columns: TmColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface TmLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: TmDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface TmMetadataRow {
  key: string;
  value: string;
}

export interface TmSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
