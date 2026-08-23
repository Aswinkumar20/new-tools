export type TfViewMode = 'preview' | 'pages' | 'metadata' | 'table';
export type TfExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type TfSourceKind = 'tiff' | 'tif' | 'json' | 'csv' | 'markdown' | 'txt';
export type TfPageKind = 'primary' | 'overlay' | 'thumbnail' | 'other';
export type TfPreviewKind = 'rect' | 'circle' | 'line' | 'text' | 'other';

export interface TfRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface TfViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface TfPage {
  id: string;
  index: number;
  name: string;
  kind: TfPageKind;
  width: number;
  height: number;
}

export interface TfMeta {
  id: string;
  index: number;
  name: string;
  value: string;
}

export interface TfPreview {
  id: string;
  index: number;
  name: string;
  kind: TfPreviewKind;
  page: string;
  colorHex: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
  r: number;
  text: string;
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
  tiffVer: string;
  width: number;
  height: number;
  compression: string;
  photometric: string;
  pageCount: number;
  metaCount: number;
  pages: TfPage[];
  metas: TfMeta[];
  previews: TfPreview[];
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
