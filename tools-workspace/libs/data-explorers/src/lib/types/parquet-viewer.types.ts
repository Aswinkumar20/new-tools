export type PqViewMode = 'schema' | 'rows' | 'profiling' | 'table';
export type PqExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type PqSourceKind = 'parquet' | 'json' | 'csv' | 'markdown' | 'txt';

export interface PqRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PqColumn {
  id: string;
  index: number;
  name: string;
  type: string;
  convertedType: string;
  repetition: string;
  path: string;
}

export interface PqRowGroup {
  index: number;
  numRows: number;
  byteSize: number;
  columnCount: number;
}

export interface PqProfile {
  column: string;
  type: string;
  count: number;
  nulls: number;
  distinct: number;
  min: string;
  max: string;
  mean: string;
}

export interface PqDataset {
  name: string;
  sourceKind: PqSourceKind;
  title: string;
  createdBy: string;
  version: number;
  numRows: number;
  columns: PqColumn[];
  rowGroups: PqRowGroup[];
  rows: Array<Record<string, string>>;
  profiles: PqProfile[];
  warnings: string[];
}

export interface PqLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: PqDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PqMetadataRow {
  key: string;
  value: string;
}

export interface PqSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
