export type NrrdExportFormat = 'original' | 'header-json' | 'summary-json' | 'png';

export type NrrdPlane = 'axial' | 'coronal' | 'sagittal';

export type NrrdColormap = 'grayscale' | 'hot';

export interface NrrdRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface NrrdHeaderInfo {
  magic: string;
  type: string;
  dimension: number;
  sizes: number[];
  spacings: number[];
  endian: string;
  encoding: string;
  space: string;
  rawFields: Record<string, string>;
}

export interface NrrdParsedVolume {
  header: NrrdHeaderInfo;
  dims: [number, number, number];
  voxelSize: [number, number, number];
  data: Float32Array;
  dataMin: number;
  dataMax: number;
  warnings: string[];
  compressedSource: boolean;
}

export interface NrrdLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: NrrdParsedVolume | null;
  warnings: string[];
  softFail: boolean;
}

export interface NrrdSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

export interface NrrdHistogramBar {
  label: string;
  count: number;
  fraction: number;
}
