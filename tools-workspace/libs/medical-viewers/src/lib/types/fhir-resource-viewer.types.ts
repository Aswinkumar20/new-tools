export interface FhirRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export type FhirNodeKind = 'object' | 'array' | 'primitive' | 'reference';

export interface FhirTreeNode {
  id: string;
  key: string;
  path: string;
  value?: string | number | boolean | null;
  kind: FhirNodeKind;
  children?: FhirTreeNode[];
}

export interface FhirResourceEntry {
  resourceType: string;
  id?: string;
  body: unknown;
}

export interface FhirReference {
  id: string;
  path: string;
  reference: string;
  display?: string;
  resourceType?: string;
}

export interface FhirTimelineEvent {
  id: string;
  label: string;
  date: string;
  isoDate: string;
  path: string;
  resourceType?: string;
}

export interface ParsedFhirDocument {
  resources: FhirResourceEntry[];
  primaryResourceType: string;
  primaryId?: string;
  references: FhirReference[];
  timeline: FhirTimelineEvent[];
  tree: FhirTreeNode[];
  warnings: string[];
}

export interface FhirLoadedResource {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  format: 'json' | 'xml';
  parsed: ParsedFhirDocument;
  warnings: string[];
}

export type FhirExportFormat = 'original' | 'summary-json' | 'references-json' | 'timeline-json';

export interface FhirSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

export type FhirViewTab = 'tree' | 'references' | 'timeline';
