export type DxViewMode = 'drawing' | 'layers' | 'entities' | 'table';
export type DxExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type DxSourceKind = 'dxf' | 'json' | 'csv' | 'markdown' | 'txt';
export type DxEntityType = 'line' | 'circle' | 'arc' | 'lwpolyline' | 'text' | 'point' | 'insert' | 'other';

export interface DxRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DxLayer {
  id: string;
  index: number;
  name: string;
  color: number;
  colorHex: string;
  visible: boolean;
  entityCount: number;
}

export interface DxEntity {
  id: string;
  index: number;
  name: string;
  type: DxEntityType;
  layer: string;
  colorHex: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  text: string;
  length: number;
  points: Array<{ x: number; y: number }>;
}

export interface DxColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface DxDataset {
  name: string;
  sourceKind: DxSourceKind;
  title: string;
  encoding: string;
  acadVer: string;
  units: string;
  layerCount: number;
  entityCount: number;
  layers: DxLayer[];
  entities: DxEntity[];
  columns: DxColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface DxLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: DxDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface DxMetadataRow {
  key: string;
  value: string;
}

export interface DxSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
