export type CtViewMode = 'parts' | 'assemblies' | 'preview' | 'table';
export type CtExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type CtSourceKind = 'catia' | 'json' | 'csv' | 'markdown' | 'txt';
export type CtPartKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';

export interface CtRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface CtPart {
  id: string;
  index: number;
  name: string;
  kind: CtPartKind;
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

export interface CtAssembly {
  id: string;
  index: number;
  name: string;
  description: string;
  instanceCount: number;
}

export interface CtInstance {
  id: string;
  index: number;
  name: string;
  part: string;
  assembly: string;
  cx: number;
  cy: number;
  cz: number;
}

export interface CtColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface CtDataset {
  name: string;
  sourceKind: CtSourceKind;
  title: string;
  encoding: string;
  version: string;
  units: string;
  partCount: number;
  assemblyCount: number;
  instanceCount: number;
  parts: CtPart[];
  assemblies: CtAssembly[];
  instances: CtInstance[];
  columns: CtColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface CtLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: CtDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface CtMetadataRow {
  key: string;
  value: string;
}

export interface CtSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
