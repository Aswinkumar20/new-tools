export type GeoPackageFeatureKind = 'point' | 'line' | 'polygon' | 'other';

export type GeoPackageFeatureFilter = 'all' | GeoPackageFeatureKind;

export type GeoPackageExportFormat = 'geojson' | 'features-csv' | 'summary-json' | 'gpkg';

export type GeoPackageLayerDataType = 'features' | 'tiles' | 'attributes' | string;

export interface GeoPackageGeometry {
  type: string;
  coordinates?: unknown;
  geometries?: GeoPackageGeometry[];
  bbox?: number[];
}

export interface GeoPackageFeature {
  type: 'Feature';
  id?: string | number;
  geometry: GeoPackageGeometry | null;
  properties: Record<string, unknown> | null;
  layerName?: string;
}

export interface GeoPackageFeatureCollection {
  type: 'FeatureCollection';
  features: GeoPackageFeature[];
  name?: string;
  layerName?: string;
}

export interface GeoPackageLayerInfo {
  tableName: string;
  dataType: GeoPackageLayerDataType;
  identifier: string;
  description: string;
  srsId: number | null;
  minX: number | null;
  minY: number | null;
  maxX: number | null;
  maxY: number | null;
  geometryColumn: string | null;
  geometryTypeName: string | null;
  featureCount: number;
}

export interface GeoPackageLoadedFile {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
  featureLayers: GeoPackageLayerInfo[];
  tileLayers: GeoPackageLayerInfo[];
  otherLayers: GeoPackageLayerInfo[];
  selectedLayer: string | null;
  collection: GeoPackageFeatureCollection;
  totalFeatureCount: number;
  truncated: boolean;
  unparseableGeometryCount: number;
  srsId: number | null;
  warnings: string[];
}

export interface GeoPackageFeatureSummary {
  id: string;
  index: number;
  name: string;
  layerName: string;
  geometryType: string;
  kind: GeoPackageFeatureKind;
  propertyCount: number;
  preview: string;
  properties: Record<string, unknown>;
}

export interface GeoPackageBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface GeoPackageDiagramStats {
  title: string;
  layers: number;
  featureLayers: number;
  tileLayers: number;
  features: number;
  totalFeatures: number;
  truncated: boolean;
  points: number;
  lines: number;
  polygons: number;
  other: number;
  propertyKeys: number;
  bounds: GeoPackageBounds | null;
  srsId: number | null;
  selectedLayer: string | null;
}

export interface GeoPackageAttributeTable {
  columns: string[];
  rows: Array<{ featureId: string; cells: string[] }>;
  truncatedRows: boolean;
  totalRows: number;
}

export interface GeoPackageRelatedToolLink {
  label: string;
  description: string;
  path: string;
}
