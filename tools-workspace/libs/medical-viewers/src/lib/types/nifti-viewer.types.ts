export type NiftiExportFormat = 'original' | 'header-json' | 'summary-json' | 'png';

export type NiftiPlane = 'axial' | 'coronal' | 'sagittal';

export type NiftiColormap = 'grayscale' | 'hot';

export interface NiftiRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface NiftiHeaderInfo {
  sizeofHdr: number;
  dim: number[];
  pixdim: number[];
  datatype: number;
  datatypeLabel: string;
  bitpix: number;
  voxOffset: number;
  sclSlope: number;
  sclInter: number;
  calMin: number;
  calMax: number;
  qformCode: number;
  sformCode: number;
  magic: string;
  description: string;
  affineNotes: string[];
}

export interface NiftiParsedVolume {
  header: NiftiHeaderInfo;
  dims: [number, number, number];
  voxelSize: [number, number, number];
  data: Float32Array;
  dataMin: number;
  dataMax: number;
  warnings: string[];
  compressedSource: boolean;
}

export interface NiftiLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: NiftiParsedVolume | null;
  warnings: string[];
  softFail: boolean;
}

export interface NiftiSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}
