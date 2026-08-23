export type DwViewMode = 'layers' | 'measurements' | 'preview' | 'table';
export type DwExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type DwSourceKind = 'dwg' | 'json' | 'csv' | 'markdown' | 'txt';
export type DwEntityType = 'line' | 'circle' | 'arc' | 'polyline' | 'text' | 'point' | 'insert' | 'other';
export type DwMeasureType = 'distance' | 'angle' | 'area';

export interface DwRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DwLayer {
  id: string;
  index: number;
  name: string;
  color: number;
  colorHex: string;
  visible: boolean;
  entityCount: number;
}

export interface DwEntity {
  id: string;
  index: number;
  name: string;
  type: DwEntityType;
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

export interface DwMeasurement {
  id: string;
  index: number;
  name: string;
  type: DwMeasureType;
  layer: string;
  value: number;
  unit: string;
  label: string;
}

export interface DwColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface DwDataset {
  name: string;
  sourceKind: DwSourceKind;
  title: string;
  encoding: string;
  version: string;
  units: string;
  layerCount: number;
  entityCount: number;
  measurementCount: number;
  layers: DwLayer[];
  entities: DwEntity[];
  measurements: DwMeasurement[];
  columns: DwColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface DwLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: DwDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface DwMetadataRow {
  key: string;
  value: string;
}

export interface DwSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
