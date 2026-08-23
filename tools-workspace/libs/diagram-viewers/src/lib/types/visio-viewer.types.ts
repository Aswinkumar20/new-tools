export type VsdViewMode = 'diagram' | 'pages' | 'shapes' | 'table';
export type VsdExportFormat = 'original' | 'summary-json' | 'shapes-csv' | 'connectors-csv' | 'png';
export type VsdSourceKind = 'vdx' | 'vsdx' | 'xml' | 'json' | 'markdown' | 'txt';

export interface VsdRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface VsdPage {
  id: string;
  index: number;
  name: string;
  width: number;
  height: number;
  shapeCount: number;
  connectorCount: number;
}

export interface VsdShape {
  id: string;
  index: number;
  pageId: string;
  pageName: string;
  label: string;
  master: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VsdConnector {
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

export interface VsdDataset {
  name: string;
  sourceKind: VsdSourceKind;
  title: string;
  pages: VsdPage[];
  shapes: VsdShape[];
  connectors: VsdConnector[];
  warnings: string[];
}

export interface VsdLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: VsdDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface VsdMetadataRow {
  key: string;
  value: string;
}

export interface VsdSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
