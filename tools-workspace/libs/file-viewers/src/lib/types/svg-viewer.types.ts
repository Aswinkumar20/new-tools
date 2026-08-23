export type SvViewMode = 'preview' | 'shapes' | 'source' | 'table';
export type SvExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'source-svg';
export type SvSourceKind = 'svg' | 'json' | 'csv' | 'markdown' | 'txt';
export type SvShapeKind = 'rect' | 'circle' | 'ellipse' | 'line' | 'polyline' | 'polygon' | 'path' | 'text' | 'other';

export interface SvRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SvViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface SvShape {
  id: string;
  index: number;
  name: string;
  kind: SvShapeKind;
  layer: string;
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

export interface SvLayer {
  id: string;
  index: number;
  name: string;
  colorHex: string;
  shapeCount: number;
}

export interface SvColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface SvDataset {
  name: string;
  sourceKind: SvSourceKind;
  title: string;
  encoding: string;
  svgVer: string;
  viewBox: string;
  width: number;
  height: number;
  shapeCount: number;
  layerCount: number;
  sourceText: string;
  shapes: SvShape[];
  layers: SvLayer[];
  columns: SvColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface SvLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: SvDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface SvMetadataRow {
  key: string;
  value: string;
}

export interface SvSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
