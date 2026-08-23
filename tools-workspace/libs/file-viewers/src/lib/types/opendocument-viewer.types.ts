export type OdViewMode = 'preview' | 'pages' | 'sheets' | 'table';
export type OdExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv';
export type OdSourceKind = 'odt' | 'ods' | 'odp' | 'json' | 'csv' | 'markdown' | 'txt';
export type OdPageKind = 'cover' | 'notes' | 'slide' | 'other';
export type OdSheetKind = 'data' | 'inventory' | 'other';
export type OdBlockKind = 'heading' | 'para' | 'list' | 'other';

export interface OdRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface OdPage {
  id: string;
  index: number;
  name: string;
  kind: OdPageKind;
}

export interface OdSheet {
  id: string;
  index: number;
  name: string;
  kind: OdSheetKind;
}

export interface OdBlock {
  id: string;
  index: number;
  name: string;
  kind: OdBlockKind;
  page: string;
  text: string;
}

export interface OdCell {
  id: string;
  index: number;
  sheet: string;
  ref: string;
  value: string;
}

export interface OdColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface OdDataset {
  name: string;
  sourceKind: OdSourceKind;
  title: string;
  author: string;
  encoding: string;
  odfVer: string;
  kind: string;
  pageCount: number;
  sheetCount: number;
  pages: OdPage[];
  sheets: OdSheet[];
  blocks: OdBlock[];
  cells: OdCell[];
  columns: OdColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface OdLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: OdDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface OdMetadataRow {
  key: string;
  value: string;
}

export interface OdSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
