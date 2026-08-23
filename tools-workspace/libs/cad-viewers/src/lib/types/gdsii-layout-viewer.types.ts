export type GdViewMode = 'plot' | 'layers' | 'cells' | 'table';
export type GdExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type GdSourceKind = 'gdsii' | 'json' | 'csv' | 'markdown' | 'txt';
export type GdFeatType = 'boundary' | 'path' | 'sref' | 'text' | 'box' | 'other';
export type GdLayerFunction = 'metal' | 'poly' | 'contact' | 'well' | 'other';

export interface GdRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface GdLayer {
  id: string;
  index: number;
  name: string;
  function: GdLayerFunction;
  stackIndex: number;
  color: number;
  colorHex: string;
  visible: boolean;
  itemCount: number;
}

export interface GdCell {
  id: string;
  index: number;
  name: string;
  itemCount: number;
}

export interface GdFeature {
  id: string;
  index: number;
  name: string;
  type: GdFeatType;
  layer: string;
  cell: string;
  colorHex: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  width: number;
  text: string;
  length: number;
  points: Array<{ x: number; y: number }>;
}

export interface GdColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface GdDataset {
  name: string;
  sourceKind: GdSourceKind;
  title: string;
  encoding: string;
  gdsVer: string;
  units: string;
  layerCount: number;
  cellCount: number;
  featCount: number;
  layers: GdLayer[];
  cells: GdCell[];
  features: GdFeature[];
  columns: GdColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface GdLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: GdDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface GdMetadataRow {
  key: string;
  value: string;
}

export interface GdSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
