export type ClimateViewMode = 'map' | 'series' | 'stations' | 'table';
export type ClimateColormap = 'grayscale' | 'hot' | 'viridis';
export type ClimateExportFormat = 'original' | 'summary-json' | 'grid-csv' | 'series-csv' | 'png';
export type ClimateSourceKind = 'json' | 'csv' | 'clim' | 'grib' | 'netcdf';

export interface ClimateRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface ClimateStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  values: number[];
}

export interface ClimateDataset {
  name: string;
  sourceKind: ClimateSourceKind;
  variable: string;
  longName: string;
  unit: string;
  times: string[];
  lats: number[];
  lons: number[];
  nx: number;
  ny: number;
  nt: number;
  grid: Float32Array<ArrayBufferLike>;
  stations: ClimateStation[];
  dataMin: number;
  dataMax: number;
  warnings: string[];
}

export interface ClimateLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: ClimateDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface ClimateMetadataRow {
  key: string;
  value: string;
}

export interface ClimateHistogramBar {
  label: string;
  count: number;
  heightPct: number;
}

export interface ClimateSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
