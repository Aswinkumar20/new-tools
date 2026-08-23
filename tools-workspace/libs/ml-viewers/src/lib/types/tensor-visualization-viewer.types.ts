export type TvViewMode = 'shapes' | 'stats' | 'preview' | 'table';
export type TvExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type TvSourceKind = 'tensor' | 'npy' | 'npz' | 'json' | 'csv' | 'markdown' | 'txt';
export type TvTensorKind = 'input' | 'output' | 'weight' | 'bias' | 'activation' | 'other';

export interface TvRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface TvTensor {
  id: string;
  index: number;
  name: string;
  kind: TvTensorKind;
  dtype: string;
  shape: number[];
  shapeLabel: string;
  numel: number;
  min: string;
  max: string;
  mean: string;
  std: string;
  nnz: string;
}

export interface TvColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface TvDataset {
  name: string;
  sourceKind: TvSourceKind;
  title: string;
  encoding: string;
  framework: string;
  tensorCount: number;
  totalNumel: number;
  tensors: TvTensor[];
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
