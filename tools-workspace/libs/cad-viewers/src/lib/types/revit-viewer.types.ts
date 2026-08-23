export type RvViewMode = 'navigate' | 'families' | 'types' | 'table';
export type RvExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type RvSourceKind = 'revit' | 'json' | 'csv' | 'markdown' | 'txt';
export type RvSolidKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';
export type RvCategory = 'Walls' | 'Floors' | 'Columns' | 'Furniture' | 'Generic' | 'other';

export interface RvRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface RvInstance {
  id: string;
  index: number;
  name: string;
  family: string;
  type: string;
  category: RvCategory;
  kind: RvSolidKind;
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

export interface RvFamily {
  id: string;
  index: number;
  name: string;
  category: RvCategory;
  description: string;
  instanceCount: number;
}

export interface RvType {
  id: string;
  index: number;
  name: string;
  family: string;
  category: RvCategory;
  description: string;
  instanceCount: number;
}

export interface RvColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface RvDataset {
  name: string;
  sourceKind: RvSourceKind;
  title: string;
  encoding: string;
  revitVer: string;
  units: string;
  instanceCount: number;
  familyCount: number;
  typeCount: number;
  instances: RvInstance[];
  families: RvFamily[];
  types: RvType[];
  columns: RvColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface RvLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: RvDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface RvMetadataRow {
  key: string;
  value: string;
}

export interface RvSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
