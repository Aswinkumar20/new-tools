export type CdgViewMode = 'types' | 'relations' | 'diagram' | 'table';
export type CdgExportFormat = 'original' | 'summary-json' | 'types-csv' | 'relations-csv' | 'png';
export type CdgSourceKind = 'puml' | 'xmi' | 'markdown' | 'json' | 'txt';
export type CdgTypeKind = 'class' | 'interface' | 'enum' | 'abstract';
export type CdgVisibility = 'public' | 'private' | 'protected' | 'package';
export type CdgRelationStyle = 'assoc' | 'inherit' | 'compose' | 'agg' | 'realize' | 'depend';

export interface CdgRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface CdgMember {
  name: string;
  type: string;
  visibility: CdgVisibility;
  kind: 'attribute' | 'operation';
}

export interface CdgType {
  id: string;
  index: number;
  name: string;
  kind: CdgTypeKind;
  stereotype: string;
  attributes: CdgMember[];
  operations: CdgMember[];
  x: number;
  y: number;
}

export interface CdgRelation {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
  style: CdgRelationStyle;
  sourceCard: string;
  targetCard: string;
}

export interface CdgDataset {
  name: string;
  sourceKind: CdgSourceKind;
  title: string;
  types: CdgType[];
  relations: CdgRelation[];
  warnings: string[];
}

export interface CdgLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: CdgDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface CdgMetadataRow {
  key: string;
  value: string;
}

export interface CdgSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
