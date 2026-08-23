export type Hdf5Colormap = 'grayscale' | 'hot' | 'viridis';
export type Hdf5Plane = 'axial' | 'coronal' | 'sagittal';
export type Hdf5ExportFormat = 'original' | 'summary-json' | 'tree-json' | 'dataset-json' | 'dataset-csv' | 'png';
export type Hdf5ViewMode = 'preview' | 'tree' | 'attributes';

export interface Hdf5RelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface Hdf5Attribute {
  name: string;
  value: string;
}

export interface Hdf5TreeNode {
  path: string;
  name: string;
  kind: 'group' | 'dataset';
  shape?: number[];
  dtype?: string;
  size?: number;
  children?: Hdf5TreeNode[];
}

export interface Hdf5DatasetPreview {
  path: string;
  shape: number[];
  dtype: string;
  rank: number;
  data: Float32Array;
  viewDims: [number, number, number];
  dataMin: number;
  dataMax: number;
  attributes: Hdf5Attribute[];
}

export interface Hdf5ParsedFile {
  filename: string;
  tree: Hdf5TreeNode[];
  datasets: Hdf5DatasetPreview[];
  defaultDatasetPath: string;
  preview: Hdf5DatasetPreview | null;
  warnings: string[];
}

export interface Hdf5LoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: Hdf5ParsedFile | null;
  warnings: string[];
  softFail: boolean;
}

export interface Hdf5MetadataRow {
  key: string;
  value: string;
}

export interface Hdf5HistogramBar {
  label: string;
  count: number;
  heightPct: number;
}

export interface Hdf5Suggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
