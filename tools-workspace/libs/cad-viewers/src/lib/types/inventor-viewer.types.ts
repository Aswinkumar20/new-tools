export type IvViewMode = 'parts' | 'assemblies' | 'preview' | 'table';
export type IvExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type IvSourceKind = 'inventor' | 'json' | 'csv' | 'markdown' | 'txt';
export type IvPartKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';

export interface IvRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface IvPart {
  id: string;
  index: number;
  name: string;
  kind: IvPartKind;
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

export interface IvAssembly {
  id: string;
  index: number;
  name: string;
  description: string;
  instanceCount: number;
}

export interface IvInstance {
  id: string;
  index: number;
  name: string;
  part: string;
  assembly: string;
  cx: number;
  cy: number;
  cz: number;
}

export interface IvColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface IvDataset {
  name: string;
  sourceKind: IvSourceKind;
  title: string;
  encoding: string;
  version: string;
  units: string;
  partCount: number;
  assemblyCount: number;
  instanceCount: number;
  parts: IvPart[];
  assemblies: IvAssembly[];
  instances: IvInstance[];
  columns: IvColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface IvLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: IvDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface IvMetadataRow {
  key: string;
  value: string;
}

export interface IvSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
