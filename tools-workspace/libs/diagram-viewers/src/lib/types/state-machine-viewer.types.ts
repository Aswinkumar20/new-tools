export type SmViewMode = 'diagram' | 'states' | 'transitions' | 'table';
export type SmExportFormat = 'original' | 'summary-json' | 'states-csv' | 'transitions-csv' | 'png';
export type SmSourceKind = 'scxml' | 'json' | 'xml' | 'markdown' | 'txt';
export type SmStateKind = 'initial' | 'normal' | 'final' | 'parallel';

export interface SmRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SmState {
  id: string;
  index: number;
  name: string;
  kind: SmStateKind;
  x: number;
  y: number;
}

export interface SmTransition {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  event: string;
  cond: string;
}

export interface SmDataset {
  name: string;
  sourceKind: SmSourceKind;
  title: string;
  initial: string;
  states: SmState[];
  transitions: SmTransition[];
  warnings: string[];
}

export interface SmLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: SmDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface SmMetadataRow {
  key: string;
  value: string;
}

export interface SmSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
