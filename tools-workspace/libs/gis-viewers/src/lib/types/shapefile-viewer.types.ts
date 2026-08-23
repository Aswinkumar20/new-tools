export type ShapefileFeatureKind = 'point' | 'line' | 'polygon' | 'other';

export type ShapefileFeatureFilter = 'all' | ShapefileFeatureKind;

export type ShapefileExportFormat = 'geojson' | 'features-csv' | 'summary-json';

export type ShapefilePartExt = 'shp' | 'dbf' | 'shx' | 'prj' | 'cpg';

export interface ShapefileGeometry {
  type: string;
  coordinates?: unknown;
  geometries?: ShapefileGeometry[];
  bbox?: number[];
}

export interface ShapefileFeature {
  type: 'Feature';
  id?: string | number;
  geometry: ShapefileGeometry | null;
  properties: Record<string, unknown> | null;
  bbox?: number[];
}

export interface ShapefileFeatureCollection {
  type: 'FeatureCollection';
  features: ShapefileFeature[];
  fileName?: string;
  name?: string;
}

export interface ShapefileLoadedFile {
  id: string;
  name: string;
  size: number;
  geojsonText: string;
  data: ShapefileFeatureCollection;
  warnings: string[];
  sourceKind: 'zip' | 'parts';
  layerName: string;
  hadDbf: boolean;
  hadPrj: boolean;
}

export interface ShapefileFeatureSummary {
  id: string;
  index: number;
  name: string;
  geometryType: string;
  kind: ShapefileFeatureKind;
  propertyCount: number;
  preview: string;
  properties: Record<string, unknown>;
}

export interface ShapefileBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ShapefileDiagramStats {
  title: string;
  layerName: string;
  features: number;
  points: number;
  lines: number;
  polygons: number;
  other: number;
  propertyKeys: number;
  bounds: ShapefileBounds | null;
}

export interface ShapefileAttributeTable {
  columns: string[];
  rows: Array<{ featureId: string; cells: string[] }>;
  truncatedRows: boolean;
  totalRows: number;
}

export interface ShapefileRelatedToolLink {
  label: string;
  description: string;
  path: string;
}
