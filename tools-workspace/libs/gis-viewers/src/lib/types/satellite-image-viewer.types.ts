import type {
  GeotiffBandSelection,
  GeotiffBounds,
  GeotiffDiagramStats,
  GeotiffRasterMetadata,
  GeotiffStretchMode
} from './geotiff-viewer.types';

export type SatelliteExportFormat = 'original' | 'metadata-json' | 'summary-json' | 'png';

export type SatelliteStretchMode = GeotiffStretchMode;

export type SatelliteCompositePreset =
  | 'true-color'
  | 'false-color-ir'
  | 'grayscale'
  | 'custom'
  | 'ndvi';

export type SatelliteColormap = 'viridis' | 'terrain';

export interface SatelliteBandSelection extends GeotiffBandSelection {}

export interface SatelliteLoadedFile {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
  metadata: GeotiffRasterMetadata;
  stats: GeotiffDiagramStats;
  warnings: string[];
  previewDataUrl: string | null;
  previewWidth: number;
  previewHeight: number;
  preset: SatelliteCompositePreset;
}

export interface SatelliteRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SatelliteMetadataRow {
  key: string;
  value: string;
}

export type { GeotiffBounds, GeotiffDiagramStats, GeotiffRasterMetadata };
