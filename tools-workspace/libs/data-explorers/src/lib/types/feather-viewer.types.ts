export type FtViewMode = 'schema' | 'preview' | 'diagram' | 'table';
export type FtExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type FtSourceKind = 'feather' | 'arrow' | 'json' | 'csv' | 'markdown' | 'txt';

export interface FtRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface FtColumn {
  id: string;
  index: number;
  name: string;
  type: string;
  offset: number;
  byteLength: number;
  x: number;
  y: number;
}

export interface FtDataset {
  name: string;
  sourceKind: FtSourceKind;
  title: string;
  version: string;
  numRows: number;
  columns: FtColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface FtLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: FtDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface FtMetadataRow {
  key: string;
  value: string;
}

export interface FtSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
