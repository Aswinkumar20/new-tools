export type NetCdfColormap = 'grayscale' | 'hot' | 'viridis';
export type NetCdfPlane = 'axial' | 'coronal' | 'sagittal';
export type NetCdfExportFormat = 'original' | 'summary-json' | 'variables-json' | 'variable-csv' | 'png';

export interface NetCdfRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface NetCdfAttribute {
  name: string;
  type: string;
  value: string;
}

export interface NetCdfDimension {
  name: string;
  size: number;
}

export interface NetCdfVariable {
  name: string;
  typeCode: number;
  typeLabel: string;
  dimIds: number[];
  dimNames: string[];
  shape: number[];
  attributes: NetCdfAttribute[];
  begin: number;
  elementCount: number;
}

export interface NetCdfVariablePreview {
  variableName: string;
  rank: number;
  shape: number[];
  dimNames: string[];
  data: Float32Array;
  viewDims: [number, number, number];
  dataMin: number;
  dataMax: number;
  sliceAxisLabel: string;
}

export interface NetCdfParsedFile {
  netcdfVersion: number;
  dimensions: NetCdfDimension[];
  variables: NetCdfVariable[];
  globalAttributes: NetCdfAttribute[];
  defaultVariableName: string;
  preview: NetCdfVariablePreview | null;
  warnings: string[];
}

export interface NetCdfLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: NetCdfParsedFile | null;
  warnings: string[];
  softFail: boolean;
}

export interface NetCdfMetadataRow {
  key: string;
  value: string;
}

export interface NetCdfHistogramBar {
  label: string;
  count: number;
  heightPct: number;
}

export interface NetCdfSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
