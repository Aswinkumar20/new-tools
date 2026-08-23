export type C4ViewMode = 'diagram' | 'context' | 'container' | 'table';
export type C4ExportFormat = 'original' | 'summary-json' | 'elements-csv' | 'relations-csv' | 'png';
export type C4SourceKind = 'puml' | 'dsl' | 'markdown' | 'json' | 'txt' | 'xml';
export type C4ElementKind = 'person' | 'system' | 'container' | 'component' | 'boundary';
export type C4Level = 'context' | 'container' | 'component' | 'mixed';

export interface C4RelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface C4Element {
  id: string;
  index: number;
  name: string;
  kind: C4ElementKind;
  stereotype: string;
  technology: string;
  description: string;
  parent: string;
  x: number;
  y: number;
}

export interface C4Relation {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
  technology: string;
}

export interface C4Dataset {
  name: string;
  sourceKind: C4SourceKind;
  title: string;
  level: C4Level;
  elements: C4Element[];
  relations: C4Relation[];
  warnings: string[];
}

export interface C4LoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: C4Dataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface C4MetadataRow {
  key: string;
  value: string;
}

export interface C4Suggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
