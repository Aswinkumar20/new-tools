export type StViewMode = 'solids' | 'measurements' | 'preview' | 'table';
export type StExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type StSourceKind = 'step' | 'json' | 'csv' | 'markdown' | 'txt';
export type StSolidKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';
export type StMeasureType = 'distance' | 'angle' | 'volume';

export interface StRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface StProduct {
  id: string;
  index: number;
  name: string;
  description: string;
}

export interface StSolid {
  id: string;
  index: number;
  name: string;
  kind: StSolidKind;
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

export interface StMeasurement {
  id: string;
  index: number;
  name: string;
  type: StMeasureType;
  value: number;
  unit: string;
  label: string;
}

export interface StColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface StDataset {
  name: string;
  sourceKind: StSourceKind;
  title: string;
  encoding: string;
  schema: string;
  units: string;
  productCount: number;
  solidCount: number;
  measurementCount: number;
  products: StProduct[];
  solids: StSolid[];
  measurements: StMeasurement[];
  columns: StColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface StLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: StDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface StMetadataRow {
  key: string;
  value: string;
}

export interface StSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
