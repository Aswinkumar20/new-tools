export type SwViewMode = 'parts' | 'assemblies' | 'preview' | 'table';
export type SwExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type SwSourceKind = 'solidworks' | 'json' | 'csv' | 'markdown' | 'txt';
export type SwPartKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';

export interface SwRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SwPart {
  id: string;
  index: number;
  name: string;
  kind: SwPartKind;
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

export interface SwAssembly {
  id: string;
  index: number;
  name: string;
  description: string;
  instanceCount: number;
}

export interface SwInstance {
  id: string;
  index: number;
  name: string;
  part: string;
  assembly: string;
  cx: number;
  cy: number;
  cz: number;
}

export interface SwColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface SwDataset {
  name: string;
  sourceKind: SwSourceKind;
  title: string;
  encoding: string;
  version: string;
  units: string;
  partCount: number;
  assemblyCount: number;
  instanceCount: number;
  parts: SwPart[];
  assemblies: SwAssembly[];
  instances: SwInstance[];
  columns: SwColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface SwLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: SwDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface SwMetadataRow {
  key: string;
  value: string;
}

export interface SwSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
