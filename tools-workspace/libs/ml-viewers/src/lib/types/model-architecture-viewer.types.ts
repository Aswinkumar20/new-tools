export type MaViewMode = 'blocks' | 'params' | 'preview' | 'table';
export type MaExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type MaSourceKind = 'arch' | 'json' | 'csv' | 'markdown' | 'txt';
export type MaBlockRole = 'stem' | 'encoder' | 'decoder' | 'head' | 'other';
export type MaParamKind = 'weight' | 'bias' | 'norm' | 'other';

export interface MaRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface MaBlock {
  id: string;
  index: number;
  name: string;
  type: string;
  role: MaBlockRole;
  inFeatures: string;
  outFeatures: string;
  paramCount: number;
}

export interface MaParam {
  id: string;
  index: number;
  name: string;
  block: string;
  kind: MaParamKind;
  dtype: string;
  shape: number[];
  shapeLabel: string;
  numel: number;
}

export interface MaColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface MaDataset {
  name: string;
  sourceKind: MaSourceKind;
  title: string;
  encoding: string;
  family: string;
  totalParams: number;
  blockCount: number;
  paramCount: number;
  blocks: MaBlock[];
  params: MaParam[];
  columns: MaColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface MaLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: MaDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface MaMetadataRow {
  key: string;
  value: string;
}

export interface MaSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
