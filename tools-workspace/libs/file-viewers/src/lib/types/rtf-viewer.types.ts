export type RtViewMode = 'preview' | 'styles' | 'blocks' | 'table';
export type RtExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'html';
export type RtSourceKind = 'rtf' | 'json' | 'csv' | 'markdown' | 'txt';
export type RtStyleKind = 'heading' | 'emphasis' | 'body' | 'other';
export type RtSpanKind = 'bold' | 'italic' | 'underline' | 'normal' | 'other';
export type RtBlockKind = 'heading' | 'para' | 'other';

export interface RtRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface RtStyle {
  id: string;
  index: number;
  name: string;
  kind: RtStyleKind;
  weight: string;
  size: string;
}

export interface RtBlock {
  id: string;
  index: number;
  name: string;
  kind: RtBlockKind;
  text: string;
}

export interface RtSpan {
  id: string;
  index: number;
  name: string;
  kind: RtSpanKind;
  style: string;
  text: string;
}

export interface RtColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface RtDataset {
  name: string;
  sourceKind: RtSourceKind;
  title: string;
  author: string;
  encoding: string;
  rtfVer: string;
  styleCount: number;
  blockCount: number;
  sourceText: string;
  styles: RtStyle[];
  blocks: RtBlock[];
  spans: RtSpan[];
  columns: RtColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface RtLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: RtDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface RtMetadataRow {
  key: string;
  value: string;
}

export interface RtSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
