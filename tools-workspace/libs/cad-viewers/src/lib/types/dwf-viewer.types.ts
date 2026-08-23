export type WfViewMode = 'sheets' | 'preview' | 'layers' | 'table';
export type WfExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type WfSourceKind = 'dwf' | 'dwfx' | 'json' | 'csv' | 'markdown' | 'txt';
export type WfEntityType = 'line' | 'circle' | 'arc' | 'polyline' | 'text' | 'point' | 'markup' | 'other';

export interface WfRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface WfSheet {
  id: string;
  index: number;
  name: string;
  width: number;
  height: number;
  entityCount: number;
}

export interface WfLayer {
  id: string;
  index: number;
  name: string;
  color: number;
  colorHex: string;
  visible: boolean;
  entityCount: number;
}

export interface WfEntity {
  id: string;
  index: number;
  name: string;
  type: WfEntityType;
  sheet: string;
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

export interface WfColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface WfDataset {
  name: string;
  sourceKind: WfSourceKind;
  title: string;
  encoding: string;
  version: string;
  units: string;
  sheetCount: number;
  layerCount: number;
  entityCount: number;
  sheets: WfSheet[];
  layers: WfLayer[];
  entities: WfEntity[];
  columns: WfColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface WfLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: WfDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface WfMetadataRow {
  key: string;
  value: string;
}

export interface WfSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
