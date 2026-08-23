export type GeotiffExportFormat = 'geotiff' | 'metadata-json' | 'summary-json' | 'png';

export type GeotiffStretchMode = 'none' | 'minmax' | 'percentile';

export interface GeotiffBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface GeotiffBandSelection {
  red: number;
  green: number;
  blue: number;
  /** When true, render single-band grayscale from `red` index. */
  grayscale: boolean;
}

export interface GeotiffOverviewInfo {
  index: number;
  width: number;
  height: number;
}

export interface CogComplianceFlags {
  isTiled: boolean;
  hasOverviews: boolean;
  imageCount: number;
  overviewSizes: Array<{ width: number; height: number }>;
  softCompliant: boolean;
  warnings: string[];
  checklist: Array<{
    id: string;
    label: string;
    status: 'ok' | 'warn' | 'fail';
    detail: string;
  }>;
}

export interface GeotiffRasterMetadata {
  width: number;
  height: number;
  samplesPerPixel: number;
  bitsPerSample: number | number[];
  photometric: number | null;
  photometricLabel: string;
  geoKeys: Record<string, number | string>;
  origin: [number, number, number] | null;
  resolution: [number, number, number] | null;
  /** [west, south, east, north] */
  bbox: [number, number, number, number] | null;
  nodata: number | null;
  tiled: boolean;
  tileWidth: number | null;
  tileHeight: number | null;
  compression: number | null;
  compressionLabel: string;
  imageCount: number;
  overviews: GeotiffOverviewInfo[];
  gdalMetadata: Record<string, string>;
  crsNote: string | null;
}

export interface GeotiffDiagramStats {
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
}

export interface GeotiffLoadedFile {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
  metadata: GeotiffRasterMetadata;
  stats: GeotiffDiagramStats;
  warnings: string[];
  cog: CogComplianceFlags | null;
  /** Cached preview data URL (may be refreshed on band/stretch change). */
  previewDataUrl: string | null;
  previewWidth: number;
  previewHeight: number;
}

export interface GeotiffRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface GeotiffMetadataRow {
  key: string;
  value: string;
}

export interface GeotiffRenderOptions {
  bands: GeotiffBandSelection;
  stretch: GeotiffStretchMode;
  opacity: number;
  imageIndex?: number;
  /** Optional pixel window [minX, minY, maxX, maxY]. */
  window?: [number, number, number, number] | null;
  maxPreviewSide?: number;
}
