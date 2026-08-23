export type ArViewMode = 'schema' | 'preview' | 'batches' | 'table';
export type ArExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type ArSourceKind = 'arrow' | 'json' | 'csv' | 'markdown' | 'txt';

export interface ArRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface ArColumn {
  id: string;
  index: number;
  name: string;
  type: string;
  path: string;
}

export interface ArBatch {
  index: number;
  numRows: number;
  bodyOffset: number;
  bodyLength: number;
}

export interface ArDataset {
  name: string;
  sourceKind: ArSourceKind;
  title: string;
  version: string;
  numRows: number;
  columns: ArColumn[];
  batches: ArBatch[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface ArLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: ArDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface ArMetadataRow {
  key: string;
  value: string;
}

export interface ArSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
