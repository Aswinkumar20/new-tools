export type UmlViewMode = 'class' | 'sequence' | 'diagram' | 'table';
export type UmlExportFormat = 'original' | 'summary-json' | 'classifiers-csv' | 'links-csv' | 'png';
export type UmlSourceKind = 'puml' | 'xmi' | 'markdown' | 'json' | 'txt';
export type UmlKind = 'class' | 'sequence' | 'mixed';
export type UmlNodeKind = 'class' | 'interface' | 'enum' | 'actor' | 'participant' | 'other';
export type UmlLinkStyle = 'assoc' | 'inherit' | 'compose' | 'realize' | 'depend' | 'message' | 'return';
export type UmlLinkKind = 'relation' | 'message';

export interface UmlRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface UmlNode {
  id: string;
  index: number;
  name: string;
  kind: UmlNodeKind;
  members: string[];
  x: number;
  y: number;
}

export interface UmlLink {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
  style: UmlLinkStyle;
  linkKind: UmlLinkKind;
}

export interface UmlDataset {
  name: string;
  sourceKind: UmlSourceKind;
  kind: UmlKind;
  title: string;
  nodes: UmlNode[];
  links: UmlLink[];
  warnings: string[];
}

export interface UmlLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: UmlDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface UmlMetadataRow {
  key: string;
  value: string;
}

export interface UmlSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
