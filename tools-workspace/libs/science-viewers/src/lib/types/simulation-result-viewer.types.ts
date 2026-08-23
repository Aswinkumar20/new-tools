export type SimulationViewMode = 'field' | 'slice' | 'probes' | 'table';
export type SimulationColormap = 'grayscale' | 'hot' | 'viridis';
export type SimulationExportFormat = 'original' | 'summary-json' | 'field-csv' | 'probes-csv' | 'png';
export type SimulationSourceKind = 'json' | 'csv' | 'vtk' | 'sim';
export type SimulationSliceAxis = 'i' | 'j';

export interface SimulationRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SimulationProbe {
  id: string;
  name: string;
  i: number;
  j: number;
  values: number[];
}

export interface SimulationMetric {
  name: string;
  values: number[];
}

export interface SimulationDataset {
  name: string;
  sourceKind: SimulationSourceKind;
  solver: string;
  fieldName: string;
  unit: string;
  nx: number;
  ny: number;
  nt: number;
  dx: number;
  dy: number;
  times: number[];
  fields: Float32Array[];
  probes: SimulationProbe[];
  metrics: SimulationMetric[];
  dataMin: number;
  dataMax: number;
  warnings: string[];
}

export interface SimulationLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: SimulationDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface SimulationMetadataRow {
  key: string;
  value: string;
}

export interface SimulationHistogramBar {
  label: string;
  count: number;
  heightPct: number;
}

export interface SimulationSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
