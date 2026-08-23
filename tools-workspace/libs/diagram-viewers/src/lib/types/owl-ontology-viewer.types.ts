export type OwlViewMode = 'diagram' | 'classes' | 'properties' | 'table';
export type OwlExportFormat = 'original' | 'summary-json' | 'classes-csv' | 'properties-csv' | 'png';
export type OwlSourceKind = 'owl' | 'rdfxml' | 'turtle' | 'json' | 'xml' | 'markdown' | 'txt';
export type OwlPropertyKind = 'object' | 'datatype' | 'annotation';
export type OwlAxiomRel = 'subclass' | 'domain' | 'range';

export interface OwlRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface OwlClass {
  id: string;
  index: number;
  name: string;
  iri: string;
  label: string;
  superClasses: string[];
  x: number;
  y: number;
}

export interface OwlProperty {
  id: string;
  index: number;
  name: string;
  iri: string;
  kind: OwlPropertyKind;
  domain: string;
  range: string;
  x: number;
  y: number;
}

export interface OwlAxiom {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  rel: OwlAxiomRel;
}

export interface OwlDataset {
  name: string;
  sourceKind: OwlSourceKind;
  title: string;
  classes: OwlClass[];
  properties: OwlProperty[];
  axioms: OwlAxiom[];
  warnings: string[];
}

export interface OwlLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: OwlDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface OwlMetadataRow {
  key: string;
  value: string;
}

export interface OwlSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
