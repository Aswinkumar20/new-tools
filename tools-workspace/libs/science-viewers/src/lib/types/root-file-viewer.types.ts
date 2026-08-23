export type RootColormap = 'grayscale' | 'hot' | 'viridis';
export type RootExportFormat = 'original' | 'summary-json' | 'objects-json' | 'histogram-csv' | 'png';

export interface RootRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface RootTreeBranch {
  name: string;
  type: string;
}

export interface RootHistogram {
  nbins: number;
  xmin: number;
  xmax: number;
  values: Float64Array;
  dataMin: number;
  dataMax: number;
}

export interface RootTreePreview {
  branches: RootTreeBranch[];
  rowCount: number;
  columns: string[];
  rows: string[][];
}

export interface RootObject {
  index: number;
  className: string;
  name: string;
  title: string;
  kind: 'histogram' | 'tree' | 'other';
  histogram?: RootHistogram;
  tree?: RootTreePreview;
}

export interface RootParsedFile {
  rootVersion: number;
  objects: RootObject[];
  defaultObjectIndex: number;
  preview: RootObject | null;
  warnings: string[];
}

export interface RootLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: RootParsedFile | null;
  warnings: string[];
  softFail: boolean;
}

export interface RootMetadataRow {
  key: string;
  value: string;
}

export interface RootHistogramBar {
  label: string;
  count: number;
  heightPct: number;
}

export interface RootSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
