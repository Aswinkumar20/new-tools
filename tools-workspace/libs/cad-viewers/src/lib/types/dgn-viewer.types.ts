export type DgViewMode = 'layers' | 'civil' | 'preview' | 'table';
export type DgExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type DgSourceKind = 'dgn' | 'json' | 'csv' | 'markdown' | 'txt';
export type DgEntityType = 'line' | 'circle' | 'arc' | 'polyline' | 'text' | 'point' | 'cell' | 'other';
export type DgCivilType = 'alignment' | 'contour' | 'station' | 'parcel';

export interface DgRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DgLayer {
  id: string;
  index: number;
  name: string;
  color: number;
  colorHex: string;
  visible: boolean;
  entityCount: number;
}

export interface DgEntity {
  id: string;
  index: number;
  name: string;
  type: DgEntityType;
  level: string;
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

export interface DgCivil {
  id: string;
  index: number;
  name: string;
  type: DgCivilType;
  level: string;
  elevation: number;
  length: number;
  label: string;
  points: Array<{ x: number; y: number }>;
}

export interface DgColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface DgDataset {
  name: string;
  sourceKind: DgSourceKind;
  title: string;
  encoding: string;
  version: string;
  units: string;
  layerCount: number;
  entityCount: number;
  civilCount: number;
  layers: DgLayer[];
  entities: DgEntity[];
  civil: DgCivil[];
  columns: DgColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface DgLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: DgDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface DgMetadataRow {
  key: string;
  value: string;
}

export interface DgSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
