export type NwViewMode = 'navigate' | 'clashes' | 'models' | 'table';
export type NwExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type NwSourceKind = 'navisworks' | 'json' | 'csv' | 'markdown' | 'txt';
export type NwSolidKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';
export type NwClashType = 'hard' | 'clearance' | 'duplicate' | 'other';
export type NwClashStatus = 'active' | 'reviewed' | 'resolved' | 'other';

export interface NwRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface NwItem {
  id: string;
  index: number;
  name: string;
  kind: NwSolidKind;
  model: string;
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

export interface NwClash {
  id: string;
  index: number;
  name: string;
  clashType: NwClashType;
  status: NwClashStatus;
  itemA: string;
  itemB: string;
  distance: number;
  cx: number;
  cy: number;
  cz: number;
}

export interface NwModel {
  id: string;
  index: number;
  name: string;
  description: string;
  itemCount: number;
}

export interface NwColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface NwDataset {
  name: string;
  sourceKind: NwSourceKind;
  title: string;
  encoding: string;
  navisVer: string;
  units: string;
  itemCount: number;
  clashCount: number;
  modelCount: number;
  items: NwItem[];
  clashes: NwClash[];
  models: NwModel[];
  columns: NwColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface NwLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: NwDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface NwMetadataRow {
  key: string;
  value: string;
}

export interface NwSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
