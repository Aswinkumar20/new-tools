import type { MvtGeoJsonFeatureCollection, MvtTile } from '../utils/mvt-decode.utils';

export type VectorTileExportFormat = 'geojson' | 'summary-json' | 'mvt' | 'attributes-csv';

export interface VectorTileLayerInfo {
  name: string;
  featureCount: number;
  extent: number;
  visible: boolean;
  color: string;
}

export interface VectorTileStats {
  title: string;
  layerCount: number;
  featureCount: number;
  extent: number;
  z: number;
  x: number;
  y: number;
  bounds: { west: number; south: number; east: number; north: number } | null;
  sourceKind: 'mvt' | 'geojson' | 'url';
}

export interface VectorTileLoadedFile {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array | null;
  tile: MvtTile | null;
  geojson: MvtGeoJsonFeatureCollection;
  layers: VectorTileLayerInfo[];
  stats: VectorTileStats;
  warnings: string[];
  z: number;
  x: number;
  y: number;
}

export interface VectorTileRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface VectorTileMetadataRow {
  key: string;
  value: string;
}

export interface VectorTileFeatureSummary {
  id: string;
  layer: string;
  geometryType: string;
  properties: Record<string, string | number | boolean | null>;
  featureIndex: number;
}

export interface VectorTileStyleOptions {
  opacity: number;
  lineWeight: number;
}
