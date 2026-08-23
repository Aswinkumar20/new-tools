export type GeoModelViewMode = 'map' | 'section' | 'column' | 'table';
export type GeoModelExportFormat = 'original' | 'summary-json' | 'layers-csv' | 'section-csv' | 'png';

export interface GeoModelRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface GeoModelSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}

export interface GeoModelMetadataRow {
  key: string;
  value: string;
}

export interface GeoModelExtent {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  zmin: number;
  zmax: number;
}

export interface GeoModelLayer {
  id: string;
  name: string;
  lithology: string;
  age: string;
  color: string;
  top: number;
  base: number;
  foldAmplitude: number;
  porosity: number | null;
  description: string;
  polygon: Array<{ x: number; y: number }>;
}

export interface GeoModelFault {
  id: string;
  name: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  dip: number | null;
}

export interface GeoModelWell {
  id: string;
  name: string;
  x: number;
  y: number;
  td: number;
}

export interface ParsedGeoModel {
  name: string;
  crs: string;
  unit: string;
  sourceKind: 'json' | 'geojson' | 'gmod' | 'csv';
  extent: GeoModelExtent;
  layers: GeoModelLayer[];
  faults: GeoModelFault[];
  wells: GeoModelWell[];
  warnings: string[];
}

export interface GeoModelLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  text: string;
  parsed: ParsedGeoModel | null;
  warnings: string[];
  softFail: boolean;
}
