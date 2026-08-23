export type TvViewMode = 'columns' | 'schema' | 'preview' | 'table';
export type TvExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-tsv' | 'png';
export type TvSourceKind = 'tsv' | 'json' | 'markdown' | 'txt';

export interface TvRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface TvColumn {
  id: string;
  index: number;
  name: string;
  type: string;
  nullable: boolean;
  nullCount: number;
  uniqueCount: number;
  min: string;
  max: string;
  sample: string;
}

export interface TvDataset {
  name: string;
  sourceKind: TvSourceKind;
  title: string;
  delimiter: string;
  quote: string;
  hasHeader: boolean;
  encoding: string;
  lineEnding: string;
  numRows: number;
  columns: TvColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface TvLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: TvDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface TvMetadataRow {
  key: string;
  value: string;
}

export interface TvSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
