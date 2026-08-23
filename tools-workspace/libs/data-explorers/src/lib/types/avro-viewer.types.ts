export type AvViewMode = 'diagram' | 'schema' | 'sample' | 'table';
export type AvExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'records-csv' | 'png';
export type AvSourceKind = 'avro' | 'avsc' | 'json' | 'markdown' | 'txt';

export interface AvRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface AvField {
  id: string;
  index: number;
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string;
  x: number;
  y: number;
}

export interface AvRecord {
  id: string;
  index: number;
  values: Record<string, string>;
}

export interface AvDataset {
  name: string;
  sourceKind: AvSourceKind;
  title: string;
  namespace: string;
  recordName: string;
  codec: string;
  fields: AvField[];
  records: AvRecord[];
  warnings: string[];
}

export interface AvLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: AvDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface AvMetadataRow {
  key: string;
  value: string;
}

export interface AvSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
