export type GbViewMode = 'artwork' | 'layers' | 'features' | 'table';
export type GbExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type GbSourceKind = 'gerber' | 'json' | 'csv' | 'markdown' | 'txt';
export type GbFeatureType = 'line' | 'arc' | 'flash' | 'polygon' | 'text' | 'circle' | 'other';
export type GbLayerFunction = 'copper' | 'silk' | 'mask' | 'paste' | 'outline' | 'other';

export interface GbRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface GbLayer {
  id: string;
  index: number;
  name: string;
  function: GbLayerFunction;
  color: number;
  colorHex: string;
  visible: boolean;
  featureCount: number;
}

export interface GbFeature {
  id: string;
  index: number;
  name: string;
  type: GbFeatureType;
  layer: string;
  polarity: string;
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

export interface GbColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface GbDataset {
  name: string;
  sourceKind: GbSourceKind;
  title: string;
  encoding: string;
  gerberVer: string;
  units: string;
  layerCount: number;
  featureCount: number;
  layers: GbLayer[];
  features: GbFeature[];
  columns: GbColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface GbLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: GbDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface GbMetadataRow {
  key: string;
  value: string;
}

export interface GbSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
