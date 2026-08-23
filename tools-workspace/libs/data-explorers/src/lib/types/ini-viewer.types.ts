export type InViewMode = 'sections' | 'keys' | 'preview' | 'table';
export type InExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type InSourceKind = 'ini' | 'json' | 'csv' | 'markdown' | 'txt';
export type InSectionKind = 'root' | 'section' | 'subsection' | 'group';

export interface InRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface InKey {
  id: string;
  index: number;
  name: string;
  path: string;
  type: string;
  value: string;
  section: string;
}

export interface InSection {
  id: string;
  index: number;
  name: string;
  path: string;
  kind: InSectionKind;
  keyCount: number;
  numRows: number;
  keys: InKey[];
  rows: Array<Record<string, string>>;
}

export interface InColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface InDataset {
  name: string;
  sourceKind: InSourceKind;
  title: string;
  encoding: string;
  sectionCount: number;
  keyCount: number;
  sections: InSection[];
  keys: InKey[];
  columns: InColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface InLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: InDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface InMetadataRow {
  key: string;
  value: string;
}

export interface InSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
