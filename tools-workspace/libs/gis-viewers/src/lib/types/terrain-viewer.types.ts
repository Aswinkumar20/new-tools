import type {
  DemColormap,
  DemDisplayMode,
  DemElevationStats,
  DemLoadedFile,
  DemMetadataRow,
  DemRelatedToolLink,
  DemSampleResult
} from './dem-viewer.types';
import type { GeotiffBounds, GeotiffRasterMetadata } from './geotiff-viewer.types';

export type TerrainExportFormat =
  | 'geotiff'
  | 'metadata-json'
  | 'summary-json'
  | 'png'
  | 'contours-geojson';

export type TerrainVizPreset = 'hillshade' | 'colored-relief' | 'contours' | 'contours-hillshade';

export interface TerrainDiagramStats {
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
  contourInterval: number;
  contourCount: number;
}

export interface TerrainLoadedFile {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
  metadata: GeotiffRasterMetadata;
  stats: TerrainDiagramStats;
  warnings: string[];
  previewDataUrl: string | null;
  previewWidth: number;
  previewHeight: number;
  elevationGrid: Float64Array;
  gridWidth: number;
  gridHeight: number;
  contoursGeoJson: GeoJSON.FeatureCollection | null;
}

export interface TerrainRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface TerrainMetadataRow {
  key: string;
  value: string;
}

export interface TerrainRenderOptions {
  colormap: DemColormap;
  displayMode: DemDisplayMode;
  vizPreset: TerrainVizPreset;
  bandIndex: number;
  hillshadeAzimuth: number;
  hillshadeAltitude: number;
  verticalExaggeration: number;
  showContours: boolean;
  contourInterval: number;
  opacity: number;
  maxPreviewSide?: number;
}

export type {
  DemColormap,
  DemDisplayMode,
  DemElevationStats,
  DemLoadedFile,
  DemMetadataRow,
  DemRelatedToolLink,
  DemSampleResult,
  GeotiffBounds,
  GeotiffRasterMetadata
};
