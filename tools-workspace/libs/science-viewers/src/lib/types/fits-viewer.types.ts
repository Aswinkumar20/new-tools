export type FitsColormap = 'grayscale' | 'hot' | 'viridis';
export type FitsPlane = 'axial' | 'coronal' | 'sagittal';
export type FitsExportFormat = 'original' | 'summary-json' | 'header-json' | 'data-csv' | 'png';
export type FitsViewMode = 'preview' | 'header' | 'wcs';

export interface FitsRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface FitsHeaderCard {
  keyword: string;
  value: string;
  comment: string;
}

export interface FitsWcsInfo {
  ctype1?: string;
  ctype2?: string;
  crval1?: number;
  crval2?: number;
  cdelt1?: number;
  cdelt2?: number;
  crpix1?: number;
  crpix2?: number;
  notes: string[];
}

export interface FitsHduPreview {
  index: number;
  name: string;
  bitpix: number;
  naxis: number;
  shape: number[];
  data: Float32Array;
  viewDims: [number, number, number];
  dataMin: number;
  dataMax: number;
  bscale: number;
  bzero: number;
}

export interface FitsHdu {
  index: number;
  name: string;
  isImage: boolean;
  headerText: string;
  cards: FitsHeaderCard[];
  bitpix: number;
  naxis: number;
  shape: number[];
  bscale: number;
  bzero: number;
  blank?: number;
  wcs: FitsWcsInfo;
  dataOffset: number;
  dataLength: number;
  preview: FitsHduPreview | null;
}

export interface FitsParsedFile {
  hdus: FitsHdu[];
  defaultHduIndex: number;
  preview: FitsHduPreview | null;
  warnings: string[];
}

export interface FitsLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: FitsParsedFile | null;
  warnings: string[];
  softFail: boolean;
}

export interface FitsMetadataRow {
  key: string;
  value: string;
}

export interface FitsHistogramBar {
  label: string;
  count: number;
  heightPct: number;
}

export interface FitsSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
