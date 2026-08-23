import type { DemColormap, DemElevationStats } from './dem-viewer.types';
import type { GeotiffBounds, GeotiffRasterMetadata } from './geotiff-viewer.types';

export type ContourSourceKind = 'dem' | 'geojson';

export type ContourExportFormat = 'geotiff' | 'contours-geojson' | 'summary-json' | 'png';

export type ContourLineColorMode = 'elevation' | 'solid';

export interface ContourDiagramStats {
  title: string;
  sourceKind: ContourSourceKind;
  width: number;
  height: number;
  samplesPerPixel: number;
  bitsPerSampleLabel: string;
  bounds: GeotiffBounds | null;
  nodata: number | null;
  crsNote: string | null;
  elevation: DemElevationStats;
  bandIndex: number;
  previewWidth: number;
  previewHeight: number;
  contourInterval: number;
  contourCount: number;
  featureCount: number;
  majorEvery: number;
}

export interface ContourLoadedFile {
  id: string;
  name: string;
  size: number;
  sourceKind: ContourSourceKind;
  /** Original DEM bytes when source is dem; empty for geojson. */
  bytes: Uint8Array;
  /** Original text when source is geojson. */
  text: string | null;
  metadata: GeotiffRasterMetadata | null;
  stats: ContourDiagramStats;
  warnings: string[];
  previewDataUrl: string | null;
  previewWidth: number;
  previewHeight: number;
  elevationGrid: Float64Array | null;
  gridWidth: number;
  gridHeight: number;
  contoursGeoJson: GeoJSON.FeatureCollection;
}

export interface ContourRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface ContourMetadataRow {
  key: string;
  value: string;
}

export interface ContourRenderOptions {
  colormap: DemColormap;
  bandIndex: number;
  contourInterval: number;
  majorEvery: number;
  showLabels: boolean;
  showUnderlay: boolean;
  lineColorMode: ContourLineColorMode;
  solidColor: string;
  lineWeight: number;
  opacity: number;
  maxPreviewSide?: number;
}

export interface ContourLabelPlacement {
  lat: number;
  lng: number;
  elevation: number;
  isMajor: boolean;
}

export interface ContourClickResult {
  elevation: number | null;
  lat: number;
  lng: number;
}

export type { DemColormap, DemElevationStats, GeotiffBounds, GeotiffRasterMetadata };
