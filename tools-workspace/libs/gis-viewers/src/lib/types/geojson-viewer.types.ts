export type GeoJsonGeometryType =
  | 'Point'
  | 'MultiPoint'
  | 'LineString'
  | 'MultiLineString'
  | 'Polygon'
  | 'MultiPolygon'
  | 'GeometryCollection';

export type GeoJsonFeatureKind = 'point' | 'line' | 'polygon' | 'other';

export type GeoJsonFeatureFilter = 'all' | GeoJsonFeatureKind;

export type GeoJsonExportFormat = 'geojson' | 'features-csv' | 'summary-json';

export interface GeoJsonLoadedFile {
  id: string;
  name: string;
  size: number;
  text: string;
  data: GeoJsonRoot;
}

export interface GeoJsonRoot {
  type: string;
  features?: GeoJsonFeature[];
  geometry?: GeoJsonGeometry | null;
  properties?: Record<string, unknown> | null;
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
  bbox?: number[];
  [key: string]: unknown;
}

export interface GeoJsonGeometry {
  type: string;
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
  bbox?: number[];
}

export interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  geometry: GeoJsonGeometry | null;
  properties: Record<string, unknown> | null;
  bbox?: number[];
}

export interface GeoJsonFeatureSummary {
  id: string;
  index: number;
  name: string;
  geometryType: string;
  kind: GeoJsonFeatureKind;
  propertyCount: number;
  preview: string;
  properties: Record<string, unknown>;
}

export interface GeoJsonBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface GeoJsonDiagramStats {
  title: string;
  features: number;
  points: number;
  lines: number;
  polygons: number;
  other: number;
  propertyKeys: number;
  bounds: GeoJsonBounds | null;
}

export interface GeoJsonRelatedToolLink {
  label: string;
  description: string;
  path: string;
}
