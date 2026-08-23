export type FpViewMode = 'plan' | 'levels' | 'rooms' | 'table';
export type FpExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type FpSourceKind = 'plan' | 'json' | 'csv' | 'markdown' | 'txt';
export type FpSpaceKind = 'room' | 'column' | 'aisle' | 'text' | 'other';
export type FpDrawType = 'lwpolyline' | 'circle' | 'line' | 'text' | 'point';

export interface FpRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface FpSpace {
  id: string;
  index: number;
  name: string;
  kind: FpSpaceKind;
  drawType: FpDrawType;
  level: string;
  colorHex: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  text: string;
  points: Array<{ x: number; y: number }>;
}

export interface FpRoom {
  id: string;
  index: number;
  name: string;
  level: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  area: number;
}

export interface FpLevel {
  id: string;
  index: number;
  name: string;
  elevation: number;
  description: string;
  roomCount: number;
}

export interface FpColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface FpDataset {
  name: string;
  sourceKind: FpSourceKind;
  title: string;
  encoding: string;
  planVer: string;
  units: string;
  spaceCount: number;
  roomCount: number;
  levelCount: number;
  spaces: FpSpace[];
  rooms: FpRoom[];
  levels: FpLevel[];
  columns: FpColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface FpLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: FpDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface FpMetadataRow {
  key: string;
  value: string;
}

export interface FpSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
