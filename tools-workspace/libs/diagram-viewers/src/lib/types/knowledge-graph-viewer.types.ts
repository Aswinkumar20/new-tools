export type KgViewMode = 'diagram' | 'entities' | 'links' | 'table';
export type KgExportFormat = 'original' | 'summary-json' | 'entities-csv' | 'links-csv' | 'png';
export type KgSourceKind = 'json' | 'xml' | 'csv' | 'markdown' | 'txt';

export interface KgRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface KgEntity {
  id: string;
  index: number;
  name: string;
  type: string;
  label: string;
  x: number;
  y: number;
}

export interface KgLink {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  rel: string;
}

export interface KgDataset {
  name: string;
  sourceKind: KgSourceKind;
  title: string;
  entities: KgEntity[];
  links: KgLink[];
  warnings: string[];
}

export interface KgLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: KgDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface KgMetadataRow {
  key: string;
  value: string;
}

export interface KgSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
