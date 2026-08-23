export type MeViewMode = 'preview' | 'disciplines' | 'systems' | 'table';
export type MeExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type MeSourceKind = 'mep' | 'json' | 'csv' | 'markdown' | 'txt';
export type MeSolidKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';
export type MeDisciplineKind = 'Mechanical' | 'Electrical' | 'Plumbing' | 'other';

export interface MeRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface MeElement {
  id: string;
  index: number;
  name: string;
  kind: MeSolidKind;
  discipline: MeDisciplineKind | string;
  system: string;
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

export interface MeSystem {
  id: string;
  index: number;
  name: string;
  discipline: string;
  description: string;
  elementCount: number;
}

export interface MeDiscipline {
  id: string;
  index: number;
  name: string;
  description: string;
  elementCount: number;
}

export interface MeColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface MeDataset {
  name: string;
  sourceKind: MeSourceKind;
  title: string;
  encoding: string;
  mepVer: string;
  units: string;
  elementCount: number;
  systemCount: number;
  discCount: number;
  elements: MeElement[];
  systems: MeSystem[];
  disciplines: MeDiscipline[];
  columns: MeColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface MeLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: MeDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface MeMetadataRow {
  key: string;
  value: string;
}

export interface MeSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
