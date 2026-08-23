export type KmlFeatureKind = 'point' | 'line' | 'polygon' | 'other';

export type KmlFeatureFilter = 'all' | KmlFeatureKind;

export type KmlExportFormat = 'kml' | 'geojson' | 'features-csv' | 'summary-json';

export interface KmlGeometry {
  type: string;
  coordinates?: unknown;
  geometries?: KmlGeometry[];
  bbox?: number[];
}

export interface KmlFeature {
  type: 'Feature';
  id?: string | number;
  geometry: KmlGeometry | null;
  properties: Record<string, unknown> | null;
  bbox?: number[];
}

export interface KmlFeatureCollection {
  type: 'FeatureCollection';
  features: KmlFeature[];
  [key: string]: unknown;
}

export interface KmlLoadedFile {
  id: string;
  name: string;
  size: number;
  text: string;
  data: KmlFeatureCollection;
  documentTitle: string;
  warnings: string[];
}

export interface KmlFeatureSummary {
  id: string;
  index: number;
  name: string;
  description: string;
  geometryType: string;
  kind: KmlFeatureKind;
  propertyCount: number;
  preview: string;
  properties: Record<string, unknown>;
}

export interface KmlBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface KmlDiagramStats {
  title: string;
  features: number;
  points: number;
  lines: number;
  polygons: number;
  other: number;
  propertyKeys: number;
  bounds: KmlBounds | null;
}

export interface KmlRelatedToolLink {
  label: string;
  description: string;
  path: string;
}
