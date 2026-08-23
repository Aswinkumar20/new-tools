import type { GeotiffBounds, GeotiffRasterMetadata, GeotiffStretchMode } from './geotiff-viewer.types';

export type RasterMapExportFormat = 'original' | 'metadata-json' | 'summary-json' | 'png';

export type RasterMapStretchMode = GeotiffStretchMode;

export type RasterMapColormap = 'grayscale' | 'viridis' | 'terrain' | 'turbo';

export type RasterMapSourceKind = 'geotiff' | 'asc';

export type RasterMapDisplayMode = 'colormap' | 'rgb';

export interface RasterMapValueStats {
  min: number;
  max: number;
  mean: number;
  range: number;
  validCount: number;
}

export interface RasterMapDiagramStats {
  title: string;
  width: number;
  height: number;
  samplesPerPixel: number;
  cellSize: number | null;
  nodata: number | null;
  bounds: GeotiffBounds | null;
  crsNote: string | null;
  values: RasterMapValueStats;
  bandIndex: number;
  previewWidth: number;
  previewHeight: number;
  sourceKind: RasterMapSourceKind;
  displayMode: RasterMapDisplayMode;
  stretch: RasterMapStretchMode;
  colormap: RasterMapColormap;
}

export interface RasterMapLoadedFile {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
  sourceKind: RasterMapSourceKind;
  /** Present for GeoTIFF sources. */
  metadata: GeotiffRasterMetadata | null;
  stats: RasterMapDiagramStats;
  warnings: string[];
  previewDataUrl: string | null;
  previewWidth: number;
  previewHeight: number;
  /** Single-band grid used for colormap re-render (preview resolution). */
  valueGrid: Float64Array;
  gridWidth: number;
  gridHeight: number;
  /** Original ASC text when source is ASCII Grid. */
  ascText: string | null;
}

export interface RasterMapRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface RasterMapMetadataRow {
  key: string;
  value: string;
}

export interface RasterMapRenderOptions {
  stretch: RasterMapStretchMode;
  colormap: RasterMapColormap;
  bandIndex: number;
  opacity: number;
  rgbMode: boolean;
  red: number;
  green: number;
  blue: number;
  maxPreviewSide?: number;
}

export type { GeotiffBounds, GeotiffRasterMetadata };
