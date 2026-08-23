export type MincExportFormat = 'original' | 'header-json' | 'summary-json' | 'png';

export type MincPlane = 'axial' | 'coronal' | 'sagittal';

export type MincColormap = 'grayscale' | 'hot';

export interface MincRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface MincDimensionInfo {
  name: string;
  size: number;
}

export interface MincHeaderInfo {
  netcdfVersion: number;
  dimensions: MincDimensionInfo[];
  variableName: string;
  variableType: number;
  dimNames: string[];
  notes: string[];
}

export interface MincParsedVolume {
  header: MincHeaderInfo;
  dims: [number, number, number];
  voxelSize: [number, number, number];
  data: Float32Array;
  dataMin: number;
  dataMax: number;
  warnings: string[];
  compressedSource: boolean;
}

export interface MincLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: MincParsedVolume | null;
  warnings: string[];
  softFail: boolean;
}

export interface MincSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

export interface MincMetadataRow {
  key: string;
  value: string;
}
