export type CrViewMode = 'parts' | 'assemblies' | 'preview' | 'table';
export type CrExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type CrSourceKind = 'creo' | 'json' | 'csv' | 'markdown' | 'txt';
export type CrPartKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';

export interface CrRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface CrPart {
  id: string;
  index: number;
  name: string;
  kind: CrPartKind;
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

export interface CrAssembly {
  id: string;
  index: number;
  name: string;
  description: string;
  instanceCount: number;
}

export interface CrInstance {
  id: string;
  index: number;
  name: string;
  part: string;
  assembly: string;
  cx: number;
  cy: number;
  cz: number;
}

export interface CrColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface CrDataset {
  name: string;
  sourceKind: CrSourceKind;
  title: string;
  encoding: string;
  version: string;
  units: string;
  partCount: number;
  assemblyCount: number;
  instanceCount: number;
  parts: CrPart[];
  assemblies: CrAssembly[];
  instances: CrInstance[];
  columns: CrColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface CrLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: CrDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface CrMetadataRow {
  key: string;
  value: string;
}

export interface CrSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
