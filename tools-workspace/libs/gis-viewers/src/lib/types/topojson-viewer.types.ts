export type TopoJsonFeatureKind = 'point' | 'line' | 'polygon' | 'other';

export type TopoJsonFeatureFilter = 'all' | TopoJsonFeatureKind;

export type TopoJsonObjectFilter = 'all' | string;

export type TopoJsonExportFormat = 'topojson' | 'geojson' | 'features-csv' | 'summary-json';

export interface TopoJsonGeometry {
  type: string;
  coordinates?: unknown;
  geometries?: TopoJsonGeometry[];
  bbox?: number[];
}

export interface TopoJsonFeature {
  type: 'Feature';
  id?: string | number;
  geometry: TopoJsonGeometry | null;
  properties: Record<string, unknown> | null;
  bbox?: number[];
  /** Name of the topology.objects key this feature came from. */
  objectName?: string;
}

export interface TopoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: TopoJsonFeature[];
  objectName?: string;
  name?: string;
  [key: string]: unknown;
}

export interface TopoJsonTopology {
  type: 'Topology';
  objects: Record<string, unknown>;
  arcs: unknown[];
  transform?: {
    scale: [number, number];
    translate: [number, number];
  };
  bbox?: number[];
  [key: string]: unknown;
}

export interface TopoJsonObjectInfo {
  name: string;
  featureCount: number;
  empty: boolean;
}

export interface TopoJsonLoadedFile {
  id: string;
  name: string;
  size: number;
  text: string;
  topology: TopoJsonTopology;
  objectNames: string[];
  objectInfo: TopoJsonObjectInfo[];
  objectCollections: Record<string, TopoJsonFeatureCollection>;
  combined: TopoJsonFeatureCollection;
  warnings: string[];
}

export interface TopoJsonFeatureSummary {
  id: string;
  index: number;
  name: string;
  objectName: string;
  geometryType: string;
  kind: TopoJsonFeatureKind;
  propertyCount: number;
  preview: string;
  properties: Record<string, unknown>;
}

export interface TopoJsonBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface TopoJsonDiagramStats {
  title: string;
  objects: number;
  arcs: number;
  features: number;
  points: number;
  lines: number;
  polygons: number;
  other: number;
  propertyKeys: number;
  bounds: TopoJsonBounds | null;
  bbox: number[] | null;
  hasTransform: boolean;
}

export interface TopoJsonRelatedToolLink {
  label: string;
  description: string;
  path: string;
}
