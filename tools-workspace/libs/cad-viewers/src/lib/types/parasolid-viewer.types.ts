export type PxViewMode = 'solids' | 'measurements' | 'preview' | 'table';
export type PxExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type PxSourceKind = 'parasolid' | 'json' | 'csv' | 'markdown' | 'txt';
export type PxSolidKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';
export type PxMeasureType = 'distance' | 'angle' | 'volume';

export interface PxRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PxBody {
  id: string;
  index: number;
  name: string;
  description: string;
}

export interface PxSolid {
  id: string;
  index: number;
  name: string;
  kind: PxSolidKind;
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

export interface PxMeasurement {
  id: string;
  index: number;
  name: string;
  type: PxMeasureType;
  value: number;
  unit: string;
  label: string;
}

export interface PxColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface PxDataset {
  name: string;
  sourceKind: PxSourceKind;
  title: string;
  encoding: string;
  schema: string;
  units: string;
  bodyCount: number;
  solidCount: number;
  measurementCount: number;
  bodies: PxBody[];
  solids: PxSolid[];
  measurements: PxMeasurement[];
  columns: PxColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface PxLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: PxDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PxMetadataRow {
  key: string;
  value: string;
}

export interface PxSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
