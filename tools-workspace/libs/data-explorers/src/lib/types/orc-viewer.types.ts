export type OrcViewMode = 'schema' | 'preview' | 'stripes' | 'table';
export type OrcExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type OrcSourceKind = 'orc' | 'json' | 'csv' | 'markdown' | 'txt';

export interface OrcRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface OrcColumn {
  id: string;
  index: number;
  name: string;
  type: string;
  path: string;
}

export interface OrcStripe {
  index: number;
  offset: number;
  numRows: number;
  dataLength: number;
  footerLength: number;
}

export interface OrcDataset {
  name: string;
  sourceKind: OrcSourceKind;
  title: string;
  version: string;
  compression: string;
  numRows: number;
  columns: OrcColumn[];
  stripes: OrcStripe[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface OrcLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: OrcDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface OrcMetadataRow {
  key: string;
  value: string;
}

export interface OrcSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
