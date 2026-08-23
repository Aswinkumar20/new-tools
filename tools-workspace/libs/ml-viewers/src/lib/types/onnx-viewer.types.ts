export type OxViewMode = 'graph' | 'tensors' | 'preview' | 'table';
export type OxExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type OxSourceKind = 'onnx' | 'json' | 'csv' | 'markdown' | 'txt';
export type OxTensorKind = 'initializer' | 'input' | 'output' | 'value';

export interface OxRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface OxNode {
  id: string;
  index: number;
  name: string;
  opType: string;
  domain: string;
  inputs: string[];
  outputs: string[];
  inputCount: number;
  outputCount: number;
}

export interface OxTensor {
  id: string;
  index: number;
  name: string;
  kind: OxTensorKind;
  dtype: string;
  shape: number[];
  shapeLabel: string;
  size: number;
  preview: string;
}

export interface OxColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface OxDataset {
  name: string;
  sourceKind: OxSourceKind;
  title: string;
  encoding: string;
  irVersion: string;
  producerName: string;
  producerVersion: string;
  domain: string;
  modelVersion: string;
  docString: string;
  opset: string;
  nodeCount: number;
  tensorCount: number;
  nodes: OxNode[];
  tensors: OxTensor[];
  columns: OxColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface OxLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: OxDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface OxMetadataRow {
  key: string;
  value: string;
}

export interface OxSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
