export type HgViewMode = 'plot' | 'layers' | 'commands' | 'table';
export type HgExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type HgSourceKind = 'hpgl' | 'json' | 'csv' | 'markdown' | 'txt';
export type HgCommandType = 'line' | 'circle' | 'arc' | 'polyline' | 'text' | 'point' | 'other';

export interface HgRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface HgLayer {
  id: string;
  index: number;
  name: string;
  color: number;
  colorHex: string;
  visible: boolean;
  commandCount: number;
}

export interface HgCommand {
  id: string;
  index: number;
  name: string;
  type: HgCommandType;
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

export interface HgColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface HgDataset {
  name: string;
  sourceKind: HgSourceKind;
  title: string;
  encoding: string;
  plotterVer: string;
  units: string;
  layerCount: number;
  commandCount: number;
  layers: HgLayer[];
  commands: HgCommand[];
  columns: HgColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface HgLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: HgDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface HgMetadataRow {
  key: string;
  value: string;
}

export interface HgSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
