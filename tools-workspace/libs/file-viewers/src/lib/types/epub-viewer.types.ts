export type EpViewMode = 'read' | 'chapters' | 'toc' | 'table';
export type EpExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'chapter-txt';
export type EpSourceKind = 'epub' | 'json' | 'csv' | 'markdown' | 'txt';
export type EpFontFamily = 'serif' | 'sans';

export interface EpRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface EpChapter {
  id: string;
  index: number;
  name: string;
  title: string;
  href: string;
  text: string;
  wordCount: number;
}

export interface EpTocEntry {
  id: string;
  index: number;
  label: string;
  href: string;
  chapter: string;
}

export interface EpMeta {
  id: string;
  index: number;
  name: string;
  value: string;
}

export interface EpColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface EpDataset {
  name: string;
  sourceKind: EpSourceKind;
  title: string;
  creator: string;
  language: string;
  encoding: string;
  epubVer: string;
  chapterCount: number;
  tocCount: number;
  chapters: EpChapter[];
  toc: EpTocEntry[];
  meta: EpMeta[];
  columns: EpColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface EpLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: EpDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface EpMetadataRow {
  key: string;
  value: string;
}

export interface EpSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
