export type MbViewMode = 'read' | 'chapters' | 'toc' | 'table';
export type MbExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'chapter-txt';
export type MbSourceKind = 'mobi' | 'json' | 'csv' | 'markdown' | 'txt';
export type MbFontFamily = 'serif' | 'sans';

export interface MbRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface MbChapter {
  id: string;
  index: number;
  name: string;
  title: string;
  href: string;
  text: string;
  wordCount: number;
}

export interface MbTocEntry {
  id: string;
  index: number;
  label: string;
  href: string;
  chapter: string;
}

export interface MbMeta {
  id: string;
  index: number;
  name: string;
  value: string;
}

export interface MbColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface MbDataset {
  name: string;
  sourceKind: MbSourceKind;
  title: string;
  creator: string;
  language: string;
  encoding: string;
  mobiVer: string;
  chapterCount: number;
  tocCount: number;
  chapters: MbChapter[];
  toc: MbTocEntry[];
  meta: MbMeta[];
  columns: MbColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface MbLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: MbDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface MbMetadataRow {
  key: string;
  value: string;
}

export interface MbSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
