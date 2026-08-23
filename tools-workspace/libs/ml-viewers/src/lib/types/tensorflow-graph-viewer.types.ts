export type TfViewMode = 'nodes' | 'tensors' | 'preview' | 'table';
export type TfExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type TfSourceKind = 'graphdef' | 'pbtxt' | 'json' | 'csv' | 'markdown' | 'txt';
export type TfTensorKind = 'placeholder' | 'constant' | 'variable' | 'output' | 'value';

export interface TfRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface TfNode {
  id: string;
  index: number;
  name: string;
  op: string;
  device: string;
  inputs: string[];
  inputCount: number;
}

export interface TfTensor {
  id: string;
  index: number;
  name: string;
  kind: TfTensorKind;
  dtype: string;
  shape: number[];
  shapeLabel: string;
  size: number;
  preview: string;
}

export interface TfColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface TfDataset {
  name: string;
  sourceKind: TfSourceKind;
  title: string;
  encoding: string;
  producer: string;
  tfVersion: string;
  nodeCount: number;
  tensorCount: number;
  nodes: TfNode[];
  tensors: TfTensor[];
  columns: TfColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface TfLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: TfDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface TfMetadataRow {
  key: string;
  value: string;
}

export interface TfSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
