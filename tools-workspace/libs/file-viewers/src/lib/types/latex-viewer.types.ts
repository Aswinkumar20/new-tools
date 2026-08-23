export type LxViewMode = 'preview' | 'structure' | 'source' | 'table';
export type LxExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'source-tex';
export type LxSourceKind = 'latex' | 'json' | 'csv' | 'markdown' | 'txt';

export interface LxRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface LxSection {
  id: string;
  index: number;
  name: string;
  title: string;
  level: number;
  text: string;
}

export interface LxCommand {
  id: string;
  index: number;
  name: string;
  value: string;
}

export interface LxEnv {
  id: string;
  index: number;
  name: string;
  kind: string;
  body: string;
}

export interface LxColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface LxDataset {
  name: string;
  sourceKind: LxSourceKind;
  title: string;
  author: string;
  docClass: string;
  encoding: string;
  latexVer: string;
  sectionCount: number;
  commandCount: number;
  envCount: number;
  sourceText: string;
  sections: LxSection[];
  commands: LxCommand[];
  envs: LxEnv[];
  columns: LxColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface LxLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: LxDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface LxMetadataRow {
  key: string;
  value: string;
}

export interface LxSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
