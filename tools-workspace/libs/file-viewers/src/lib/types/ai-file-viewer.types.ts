export type AiViewMode = 'preview' | 'artboards' | 'layers' | 'table';
export type AiExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type AiSourceKind = 'ai' | 'json' | 'csv' | 'markdown' | 'txt';
export type AiPathKind = 'rect' | 'circle' | 'ellipse' | 'line' | 'text' | 'other';

export interface AiRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface AiViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface AiArtboard {
  id: string;
  index: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  colorHex: string;
}

export interface AiLayer {
  id: string;
  index: number;
  name: string;
  colorHex: string;
  pathCount: number;
}

export interface AiPath {
  id: string;
  index: number;
  name: string;
  kind: AiPathKind;
  artboard: string;
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

export interface AiColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface AiDataset {
  name: string;
  sourceKind: AiSourceKind;
  title: string;
  encoding: string;
  aiVer: string;
  width: number;
  height: number;
  artboardCount: number;
  layerCount: number;
  pathCount: number;
  artboards: AiArtboard[];
  layers: AiLayer[];
  paths: AiPath[];
  columns: AiColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface AiLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: AiDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface AiMetadataRow {
  key: string;
  value: string;
}

export interface AiSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
