export type MatColormap = 'grayscale' | 'hot' | 'viridis';
export type MatPlane = 'axial' | 'coronal' | 'sagittal';
export type MatExportFormat = 'original' | 'summary-json' | 'variables-json' | 'variable-csv' | 'png';

export interface MatRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface MatVariable {
  name: string;
  className: string;
  shape: number[];
  rank: number;
  dtype: string;
  bytes?: number;
}

export interface MatVariablePreview {
  variableName: string;
  rank: number;
  shape: number[];
  data: Float32Array;
  viewDims: [number, number, number];
  dataMin: number;
  dataMax: number;
  sliceAxisLabel: string;
}

export interface MatParsedFile {
  format: 'mat-v5' | 'mat-v73';
  matVersion: string;
  variables: MatVariable[];
  defaultVariableName: string;
  preview: MatVariablePreview | null;
  variableData: Record<string, Float32Array>;
  warnings: string[];
}

export interface MatLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: MatParsedFile | null;
  warnings: string[];
  softFail: boolean;
}

export interface MatMetadataRow {
  key: string;
  value: string;
}

export interface MatHistogramBar {
  label: string;
  count: number;
  heightPct: number;
}

export interface MatSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
