export type KsViewMode = 'layers' | 'shapes' | 'preview' | 'table';
export type KsExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type KsSourceKind = 'keras' | 'h5' | 'zip' | 'json' | 'csv' | 'markdown' | 'txt';
export type KsShapeKind = 'input' | 'output' | 'weight' | 'bias' | 'other';

export interface KsRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface KsLayer {
  id: string;
  index: number;
  name: string;
  type: string;
  activation: string;
  units: string;
  inputShape: string;
  outputShape: string;
  trainable: boolean;
}

export interface KsShape {
  id: string;
  index: number;
  name: string;
  kind: KsShapeKind;
  dtype: string;
  shape: number[];
  shapeLabel: string;
  layer: string;
}

export interface KsColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface KsDataset {
  name: string;
  sourceKind: KsSourceKind;
  title: string;
  encoding: string;
  kerasVersion: string;
  backend: string;
  className: string;
  layerCount: number;
  shapeCount: number;
  layers: KsLayer[];
  shapes: KsShape[];
  columns: KsColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface KsLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: KsDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface KsMetadataRow {
  key: string;
  value: string;
}

export interface KsSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
