export type RdfViewMode = 'diagram' | 'triples' | 'graph' | 'table';
export type RdfExportFormat = 'original' | 'summary-json' | 'triples-csv' | 'nodes-csv' | 'png';
export type RdfSourceKind = 'turtle' | 'rdfxml' | 'ntriples' | 'json' | 'xml' | 'markdown' | 'txt';
export type RdfNodeKind = 'iri' | 'blank';

export interface RdfRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface RdfPrefix {
  prefix: string;
  iri: string;
}

export interface RdfNode {
  id: string;
  index: number;
  name: string;
  kind: RdfNodeKind;
  iri: string;
  prefix: string;
  x: number;
  y: number;
}

export interface RdfTriple {
  id: string;
  index: number;
  subject: string;
  predicate: string;
  object: string;
  subjectName: string;
  predicateName: string;
  objectName: string;
  literal: boolean;
}

export interface RdfDataset {
  name: string;
  sourceKind: RdfSourceKind;
  title: string;
  prefixes: RdfPrefix[];
  nodes: RdfNode[];
  triples: RdfTriple[];
  warnings: string[];
}

export interface RdfLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: RdfDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface RdfMetadataRow {
  key: string;
  value: string;
}

export interface RdfSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
