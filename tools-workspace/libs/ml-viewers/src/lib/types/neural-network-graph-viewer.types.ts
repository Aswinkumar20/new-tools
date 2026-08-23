export type NnViewMode = 'layers' | 'connections' | 'preview' | 'table';
export type NnExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type NnSourceKind = 'nn' | 'json' | 'csv' | 'markdown' | 'txt';

export interface NnRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface NnLayer {
  id: string;
  index: number;
  name: string;
  type: string;
  units: string;
  activation: string;
}

export interface NnConnection {
  id: string;
  index: number;
  source: string;
  target: string;
  label: string;
  weight: string;
}

export interface NnColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface NnDataset {
  name: string;
  sourceKind: NnSourceKind;
  title: string;
  encoding: string;
  framework: string;
  layerCount: number;
  connectionCount: number;
  layers: NnLayer[];
  connections: NnConnection[];
  columns: NnColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface NnLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: NnDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface NnMetadataRow {
  key: string;
  value: string;
}

export interface NnSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
