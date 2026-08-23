export type DioViewMode = 'diagram' | 'pages' | 'shapes' | 'table';
export type DioExportFormat = 'original' | 'summary-json' | 'shapes-csv' | 'connectors-csv' | 'png';
export type DioSourceKind = 'drawio' | 'xml' | 'json' | 'markdown' | 'txt' | 'svg';

export interface DioRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DioPage {
  id: string;
  index: number;
  name: string;
  width: number;
  height: number;
  shapeCount: number;
  connectorCount: number;
}

export interface DioShape {
  id: string;
  index: number;
  pageId: string;
  pageName: string;
  label: string;
  style: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DioConnector {
  id: string;
  index: number;
  pageId: string;
  pageName: string;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
}

export interface DioDataset {
  name: string;
  sourceKind: DioSourceKind;
  title: string;
  pages: DioPage[];
  shapes: DioShape[];
  connectors: DioConnector[];
  warnings: string[];
}

export interface DioLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: DioDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface DioMetadataRow {
  key: string;
  value: string;
}

export interface DioSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
