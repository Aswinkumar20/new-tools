export type PtViewMode = 'layers' | 'params' | 'preview' | 'table';
export type PtExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type PtSourceKind = 'torch' | 'zip' | 'json' | 'csv' | 'markdown' | 'txt';
export type PtParamKind = 'weight' | 'bias' | 'buffer' | 'other';

export interface PtRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PtLayer {
  id: string;
  index: number;
  name: string;
  type: string;
  inFeatures: string;
  outFeatures: string;
  paramCount: number;
}

export interface PtParam {
  id: string;
  index: number;
  name: string;
  layer: string;
  kind: PtParamKind;
  dtype: string;
  shape: number[];
  shapeLabel: string;
  numel: number;
}

export interface PtColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface PtDataset {
  name: string;
  sourceKind: PtSourceKind;
  title: string;
  encoding: string;
  torchVersion: string;
  format: string;
  layerCount: number;
  paramCount: number;
  layers: PtLayer[];
  params: PtParam[];
  columns: PtColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface PtLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: PtDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PtMetadataRow {
  key: string;
  value: string;
}

export interface PtSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
