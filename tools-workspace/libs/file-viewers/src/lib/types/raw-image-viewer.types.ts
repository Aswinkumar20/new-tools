export type RwViewMode = 'preview' | 'exif' | 'channels' | 'table';
export type RwExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type RwSourceKind = 'raw' | 'cr2' | 'nef' | 'arw' | 'dng' | 'json' | 'csv' | 'markdown' | 'txt';
export type RwChannelKind = 'red' | 'green' | 'blue' | 'luma' | 'other';
export type RwPreviewKind = 'rect' | 'circle' | 'line' | 'text' | 'other';

export interface RwRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface RwViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface RwChannel {
  id: string;
  index: number;
  name: string;
  kind: RwChannelKind;
  pattern: string;
}

export interface RwExif {
  id: string;
  index: number;
  name: string;
  value: string;
}

export interface RwPreview {
  id: string;
  index: number;
  name: string;
  kind: RwPreviewKind;
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

export interface RwColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface RwDataset {
  name: string;
  sourceKind: RwSourceKind;
  title: string;
  encoding: string;
  rawVer: string;
  width: number;
  height: number;
  make: string;
  model: string;
  format: string;
  iso: string;
  demosaic: string;
  channelCount: number;
  exifCount: number;
  channels: RwChannel[];
  exifs: RwExif[];
  previews: RwPreview[];
  columns: RwColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface RwLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: RwDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface RwMetadataRow {
  key: string;
  value: string;
}

export interface RwSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
