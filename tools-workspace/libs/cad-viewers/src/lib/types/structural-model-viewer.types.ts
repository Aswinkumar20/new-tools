export type SrViewMode = 'preview' | 'members' | 'properties' | 'table';
export type SrExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type SrSourceKind = 'structural' | 'json' | 'csv' | 'markdown' | 'txt';
export type SrSolidKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';
export type SrMemberType = 'Beam' | 'Column' | 'Slab' | 'Footing' | 'Member' | 'other';

export interface SrRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SrMember {
  id: string;
  index: number;
  name: string;
  kind: SrSolidKind;
  memberType: SrMemberType;
  section: string;
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

export interface SrProperty {
  id: string;
  index: number;
  name: string;
  pset: string;
  member: string;
  value: string;
  unit: string;
}

export interface SrSection {
  id: string;
  index: number;
  name: string;
  description: string;
  memberCount: number;
}

export interface SrColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface SrDataset {
  name: string;
  sourceKind: SrSourceKind;
  title: string;
  encoding: string;
  structVer: string;
  units: string;
  memberCount: number;
  propCount: number;
  sectionCount: number;
  members: SrMember[];
  properties: SrProperty[];
  sections: SrSection[];
  columns: SrColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface SrLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: SrDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface SrMetadataRow {
  key: string;
  value: string;
}

export interface SrSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
