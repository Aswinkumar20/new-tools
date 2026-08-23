export type SqlsViewMode = 'diagram' | 'tables' | 'fks' | 'table';
export type SqlsExportFormat = 'original' | 'summary-json' | 'tables-csv' | 'fks-csv' | 'png';
export type SqlsSourceKind = 'sql' | 'markdown' | 'json' | 'xml' | 'txt';

export interface SqlsRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SqlsColumn {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  unique: boolean;
  nullable: boolean;
  refTable: string;
  refColumn: string;
}

export interface SqlsTable {
  id: string;
  index: number;
  name: string;
  columns: SqlsColumn[];
  x: number;
  y: number;
}

export interface SqlsFk {
  id: string;
  index: number;
  name: string;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  sourceColumn: string;
  targetColumn: string;
}

export interface SqlsDataset {
  name: string;
  sourceKind: SqlsSourceKind;
  title: string;
  tables: SqlsTable[];
  fks: SqlsFk[];
  warnings: string[];
}

export interface SqlsLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: SqlsDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface SqlsMetadataRow {
  key: string;
  value: string;
}

export interface SqlsSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
