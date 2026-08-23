export type PkViewMode = 'types' | 'warnings' | 'preview' | 'table';
export type PkExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type PkSourceKind = 'pkl' | 'json' | 'csv' | 'markdown' | 'txt';
export type PkTypeKind = 'class' | 'array' | 'mapping' | 'module' | 'function' | 'other';
export type PkWarningLevel = 'info' | 'warn' | 'danger';

export interface PkRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PkTypeHint {
  id: string;
  index: number;
  name: string;
  module: string;
  kind: PkTypeKind;
  qualified: string;
}

export interface PkWarning {
  id: string;
  index: number;
  level: PkWarningLevel;
  message: string;
}

export interface PkColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface PkDataset {
  name: string;
  sourceKind: PkSourceKind;
  title: string;
  encoding: string;
  protocol: string;
  python: string;
  typeCount: number;
  warningCount: number;
  types: PkTypeHint[];
  warningItems: PkWarning[];
  columns: PkColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface PkLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: PkDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PkMetadataRow {
  key: string;
  value: string;
}

export interface PkSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
