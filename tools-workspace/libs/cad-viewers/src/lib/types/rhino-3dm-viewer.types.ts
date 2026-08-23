export type RhViewMode = 'surfaces' | 'layers' | 'preview' | 'table';
export type RhExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type RhSourceKind = 'rhino' | 'json' | 'csv' | 'markdown' | 'txt';
export type RhSurfaceKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';

export interface RhRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface RhSurface {
  id: string;
  index: number;
  name: string;
  kind: RhSurfaceKind;
  colorHex: string;
  cx: number;
  cy: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  r: number;
  h: number;
  volume: number;
}

export interface RhLayer {
  id: string;
  index: number;
  name: string;
  description: string;
  instanceCount: number;
}

export interface RhInstance {
  id: string;
  index: number;
  name: string;
  surface: string;
  layer: string;
  cx: number;
  cy: number;
  cz: number;
}

export interface RhColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface RhDataset {
  name: string;
  sourceKind: RhSourceKind;
  title: string;
  encoding: string;
  version: string;
  units: string;
  surfaceCount: number;
  layerCount: number;
  instanceCount: number;
  surfaces: RhSurface[];
  layers: RhLayer[];
  instances: RhInstance[];
  columns: RhColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface RhLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: RhDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface RhMetadataRow {
  key: string;
  value: string;
}

export interface RhSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
