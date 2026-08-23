export type HcViewMode = 'preview' | 'metadata' | 'frames' | 'table';
export type HcExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type HcSourceKind = 'heic' | 'heif' | 'json' | 'csv' | 'markdown' | 'txt';
export type HcFrameKind = 'primary' | 'grid' | 'thumbnail' | 'other';
export type HcPreviewKind = 'rect' | 'circle' | 'line' | 'text' | 'other';

export interface HcRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface HcViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface HcFrame {
  id: string;
  index: number;
  name: string;
  kind: HcFrameKind;
  width: number;
  height: number;
}

export interface HcMeta {
  id: string;
  index: number;
  name: string;
  value: string;
  group: 'meta' | 'exif';
}

export interface HcPreview {
  id: string;
  index: number;
  name: string;
  kind: HcPreviewKind;
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

export interface HcColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface HcDataset {
  name: string;
  sourceKind: HcSourceKind;
  title: string;
  encoding: string;
  heicVer: string;
  width: number;
  height: number;
  make: string;
  model: string;
  frameCount: number;
  metaCount: number;
  frames: HcFrame[];
  metas: HcMeta[];
  previews: HcPreview[];
  columns: HcColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface HcLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: HcDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface HcMetadataRow {
  key: string;
  value: string;
}

export interface HcSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
