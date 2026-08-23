export type PlViewMode = 'plot' | 'pens' | 'commands' | 'table';
export type PlExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type PlSourceKind = 'plt' | 'json' | 'csv' | 'markdown' | 'txt';
export type PlCommandType = 'line' | 'circle' | 'arc' | 'polyline' | 'text' | 'point' | 'other';

export interface PlRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PlPen {
  id: string;
  index: number;
  name: string;
  color: number;
  colorHex: string;
  visible: boolean;
  commandCount: number;
}

export interface PlCommand {
  id: string;
  index: number;
  name: string;
  type: PlCommandType;
  pen: string;
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

export interface PlColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface PlDataset {
  name: string;
  sourceKind: PlSourceKind;
  title: string;
  encoding: string;
  plotterVer: string;
  units: string;
  penCount: number;
  commandCount: number;
  pens: PlPen[];
  commands: PlCommand[];
  columns: PlColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface PlLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: PlDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PlMetadataRow {
  key: string;
  value: string;
}

export interface PlSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
