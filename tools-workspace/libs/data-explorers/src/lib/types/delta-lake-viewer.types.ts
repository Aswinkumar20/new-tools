export type DlViewMode = 'versions' | 'schema' | 'preview' | 'table';
export type DlExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type DlSourceKind = 'delta' | 'json' | 'csv' | 'markdown' | 'txt';

export interface DlRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DlColumn {
  id: string;
  index: number;
  name: string;
  type: string;
  path: string;
  nullable: boolean;
}

export interface DlVersion {
  version: number;
  timestamp: string;
  operation: string;
  numFiles: number;
  numRows: number;
}

export interface DlDataset {
  name: string;
  sourceKind: DlSourceKind;
  title: string;
  protocol: string;
  numRows: number;
  columns: DlColumn[];
  versions: DlVersion[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface DlLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: DlDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface DlMetadataRow {
  key: string;
  value: string;
}

export interface DlSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
