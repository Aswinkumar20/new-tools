export type PumlViewMode = 'diagram' | 'uml' | 'c4' | 'table';
export type PumlExportFormat = 'original' | 'summary-json' | 'elements-csv' | 'relations-csv' | 'png';
export type PumlSourceKind = 'puml' | 'markdown' | 'json' | 'txt';
export type PumlKind = 'uml' | 'c4' | 'mixed';
export type PumlElementKind =
  | 'class'
  | 'interface'
  | 'enum'
  | 'actor'
  | 'usecase'
  | 'person'
  | 'system'
  | 'container'
  | 'component'
  | 'boundary'
  | 'other';
export type PumlRelationStyle = 'assoc' | 'compose' | 'agg' | 'extend' | 'realize' | 'depend' | 'rel';

export interface PumlRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PumlElement {
  id: string;
  index: number;
  name: string;
  kind: PumlElementKind;
  stereotype: string;
  members: string[];
  group: string;
  x: number;
  y: number;
}

export interface PumlRelation {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
  style: PumlRelationStyle;
  sourceCard: string;
  targetCard: string;
}

export interface PumlDataset {
  name: string;
  sourceKind: PumlSourceKind;
  kind: PumlKind;
  title: string;
  elements: PumlElement[];
  relations: PumlRelation[];
  warnings: string[];
}

export interface PumlLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: PumlDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PumlMetadataRow {
  key: string;
  value: string;
}

export interface PumlSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
