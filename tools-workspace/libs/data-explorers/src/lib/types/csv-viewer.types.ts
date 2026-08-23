export type CvViewMode = 'columns' | 'schema' | 'preview' | 'table';
export type CvExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type CvSourceKind = 'csv' | 'json' | 'markdown' | 'txt';

export interface CvRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface CvColumn {
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

export interface CvDataset {
  name: string;
  sourceKind: CvSourceKind;
  title: string;
  delimiter: string;
  quote: string;
  hasHeader: boolean;
  encoding: string;
  lineEnding: string;
  numRows: number;
  columns: CvColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface CvLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: CvDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface CvMetadataRow {
  key: string;
  value: string;
}

export interface CvSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
