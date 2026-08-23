export type DbmlViewMode = 'diagram' | 'tables' | 'refs' | 'table';
export type DbmlExportFormat = 'original' | 'summary-json' | 'tables-csv' | 'refs-csv' | 'png';
export type DbmlSourceKind = 'dbml' | 'markdown' | 'json' | 'xml' | 'txt';
export type DbmlRelKind = '>' | '<' | '-' | '<>' | string;

export interface DbmlRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DbmlColumn {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  unique: boolean;
  nullable: boolean;
  increment: boolean;
  note: string;
  refTable: string;
  refColumn: string;
}

export interface DbmlTable {
  id: string;
  index: number;
  name: string;
  alias: string;
  note: string;
  columns: DbmlColumn[];
  x: number;
  y: number;
}

export interface DbmlRef {
  id: string;
  index: number;
  name: string;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  sourceColumn: string;
  targetColumn: string;
  rel: DbmlRelKind;
}

export interface DbmlDataset {
  name: string;
  sourceKind: DbmlSourceKind;
  title: string;
  databaseType: string;
  tables: DbmlTable[];
  refs: DbmlRef[];
  warnings: string[];
}

export interface DbmlLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: DbmlDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface DbmlMetadataRow {
  key: string;
  value: string;
}

export interface DbmlSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
