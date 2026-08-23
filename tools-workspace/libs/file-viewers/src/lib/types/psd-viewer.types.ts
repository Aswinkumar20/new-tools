export type PdViewMode = 'preview' | 'layers' | 'effects' | 'table';
export type PdExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type PdSourceKind = 'psd' | 'json' | 'csv' | 'markdown' | 'txt';
export type PdLayerKind = 'rect' | 'circle' | 'line' | 'text' | 'other';

export interface PdRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PdViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface PdLayer {
  id: string;
  index: number;
  name: string;
  kind: PdLayerKind;
  visible: boolean;
  colorHex: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  x2: number;
  y2: number;
  text: string;
}

export interface PdEffect {
  id: string;
  index: number;
  name: string;
  layer: string;
  kind: string;
}

export interface PdChannel {
  id: string;
  index: number;
  name: string;
}

export interface PdColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface PdDataset {
  name: string;
  sourceKind: PdSourceKind;
  title: string;
  encoding: string;
  psdVer: string;
  width: number;
  height: number;
  layerCount: number;
  effectCount: number;
  channelCount: number;
  layers: PdLayer[];
  effects: PdEffect[];
  channels: PdChannel[];
  columns: PdColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface PdLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: PdDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PdMetadataRow {
  key: string;
  value: string;
}

export interface PdSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
