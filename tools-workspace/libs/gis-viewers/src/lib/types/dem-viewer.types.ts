import type { GeotiffBounds, GeotiffRasterMetadata } from './geotiff-viewer.types';

export type DemExportFormat = 'geotiff' | 'metadata-json' | 'summary-json' | 'png';

export type DemColormap = 'grayscale' | 'terrain' | 'viridis' | 'hypsometric';

export type DemDisplayMode = 'elevation' | 'hillshade' | 'shaded-relief';

export interface DemElevationStats {
  min: number;
  max: number;
  mean: number;
  range: number;
  validCount: number;
}

export interface DemDiagramStats {
  title: string;
  width: number;
  height: number;
  samplesPerPixel: number;
  bitsPerSampleLabel: string;
  photometricLabel: string;
  compressionLabel: string;
  tiled: boolean;
  imageCount: number;
  bounds: GeotiffBounds | null;
  nodata: number | null;
  crsNote: string | null;
  elevation: DemElevationStats;
  bandIndex: number;
  previewWidth: number;
  previewHeight: number;
}

export interface DemLoadedFile {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
  metadata: GeotiffRasterMetadata;
  stats: DemDiagramStats;
  warnings: string[];
  previewDataUrl: string | null;
  previewWidth: number;
  previewHeight: number;
  /** Elevation grid used for sampling / re-render (preview resolution). */
  elevationGrid: Float64Array;
  gridWidth: number;
  gridHeight: number;
}

export interface DemRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DemMetadataRow {
  key: string;
  value: string;
}

export interface DemRenderOptions {
  colormap: DemColormap;
  displayMode: DemDisplayMode;
  bandIndex: number;
  hillshadeAzimuth: number;
  hillshadeAltitude: number;
  opacity: number;
  zFactor?: number;
  maxPreviewSide?: number;
}

export interface DemSampleResult {
  elevation: number | null;
  lat: number;
  lng: number;
}

export type { GeotiffBounds, GeotiffRasterMetadata };
