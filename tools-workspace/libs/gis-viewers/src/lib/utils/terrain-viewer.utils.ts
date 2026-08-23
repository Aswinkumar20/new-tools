import type { Map as LeafletMap, ImageOverlay, LatLngBoundsExpression, Layer } from 'leaflet';
import {
  TERRAIN_MAX_CONTOUR_LEVELS,
  TERRAIN_MAX_FILE_BYTES,
  TERRAIN_MAX_PREVIEW_SIDE,
  TERRAIN_SAMPLE_BASE64,
  TERRAIN_SUPPORTED_EXTENSIONS
} from '../constants/terrain-viewer.constants';
import type {
  DemColormap,
  DemDisplayMode,
  TerrainDiagramStats,
  TerrainLoadedFile,
  TerrainMetadataRow,
  TerrainRenderOptions,
  TerrainVizPreset
} from '../types/terrain-viewer.types';
import type { GeotiffBounds, GeotiffRasterMetadata } from '../types/geotiff-viewer.types';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';
import {
  bitsPerSampleLabel,
  bboxToBounds,
  downloadBinaryFile,
  extractRasterMetadata,
  fromArrayBuffer,
  readPreviewRasters,
  uint8ToArrayBuffer
} from './geotiff-raster.utils';
import {
  computeElevationStats,
  copyElevationBand,
  drawContoursOnCanvas,
  extractContours,
  legendGradientCss,
  renderElevationDataUrl,
  sampleElevationAtLatLng,
  suggestContourInterval
} from './dem-terrain.utils';

export {
  configureLeafletDefaultIcons,
  downloadBinaryFile,
  downloadTextFile,
  loadLeaflet,
  fromArrayBuffer,
  legendGradientCss,
  sampleElevationAtLatLng,
  suggestContourInterval,
  extractContours
};

type LeafletModule = typeof import('leaflet');

export function ensureTerrainStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'terrainCss');
}

export function getTerrainFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function formatTerrainFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateTerrainFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > TERRAIN_MAX_FILE_BYTES) {
    return `File is too large (max ${formatTerrainFileSize(TERRAIN_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidTerrainFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const file of Array.from(files)) {
    const ext = getTerrainFileExtension(file.name);
    if (!TERRAIN_SUPPORTED_EXTENSIONS.includes(ext)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .tif, .tiff, or .geotiff elevation GeoTIFF)'
      });
      continue;
    }
    const sizeError = validateTerrainFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob !== 'function') {
    throw new Error('Base64 decode is not available in this environment');
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Builds a sample terrain .tif File (lastModified: 0). */
export function createSampleTerrainFile(): File {
  const bytes = base64ToUint8Array(TERRAIN_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-terrain.tif', {
    type: 'image/tiff',
    lastModified: 0
  });
}

export async function readTerrainFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
        return;
      }
      reject(new Error('Failed to read terrain file'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read terrain file'));
    reader.readAsArrayBuffer(file);
  });
}

export function vizPresetToDisplay(
  preset: TerrainVizPreset
): { displayMode: DemDisplayMode; showContours: boolean } {
  switch (preset) {
    case 'hillshade':
      return { displayMode: 'hillshade', showContours: false };
    case 'colored-relief':
      return { displayMode: 'shaded-relief', showContours: false };
    case 'contours':
      return { displayMode: 'elevation', showContours: true };
    case 'contours-hillshade':
      return { displayMode: 'hillshade', showContours: true };
    default:
      return { displayMode: 'shaded-relief', showContours: false };
  }
}

export function buildTerrainWarnings(
  metadata: GeotiffRasterMetadata,
  elevationStats: ReturnType<typeof computeElevationStats>
): string[] {
  const warnings: string[] = [];
  if (!metadata.bbox) {
    warnings.push('No georeferencing found — overlay will use a default world view.');
  }
  if (metadata.crsNote && /Projected/i.test(metadata.crsNote)) {
    warnings.push(metadata.crsNote);
  }
  if (metadata.photometric === 2 || metadata.samplesPerPixel >= 3) {
    warnings.push(
      'This looks like an RGB raster rather than a single-band DEM. Select an elevation band if available.'
    );
  }
  if (elevationStats.validCount === 0) {
    warnings.push('No valid elevation samples found (all nodata or empty).');
  } else if (elevationStats.range === 0) {
    warnings.push('Flat terrain — elevation is constant across the raster.');
  }
  return warnings;
}

export function buildTerrainStats(
  metadata: GeotiffRasterMetadata,
  fileName: string,
  elevation: ReturnType<typeof computeElevationStats>,
  bandIndex: number,
  previewWidth: number,
  previewHeight: number,
  contourInterval: number,
  contourCount: number
): TerrainDiagramStats {
  return {
    title: fileName.replace(/\.(tif|tiff|geotiff)$/i, '') || 'Terrain',
    width: metadata.width,
    height: metadata.height,
    samplesPerPixel: metadata.samplesPerPixel,
    bitsPerSampleLabel: bitsPerSampleLabel(metadata.bitsPerSample),
    photometricLabel: metadata.photometricLabel,
    compressionLabel: metadata.compressionLabel,
    tiled: metadata.tiled,
    imageCount: metadata.imageCount,
    bounds: bboxToBounds(metadata.bbox),
    nodata: metadata.nodata,
    crsNote: metadata.crsNote,
    elevation,
    bandIndex,
    previewWidth,
    previewHeight,
    contourInterval,
    contourCount
  };
}

export function createTerrainFileRecord(
  file: File,
  bytes: Uint8Array,
  metadata: GeotiffRasterMetadata,
  stats: TerrainDiagramStats,
  warnings: string[],
  preview: { dataUrl: string; width: number; height: number },
  elevationGrid: Float64Array,
  contoursGeoJson: GeoJSON.FeatureCollection | null
): TerrainLoadedFile {
  return {
    id: `${file.name}|${file.size}|${file.lastModified}`,
    name: file.name,
    size: file.size,
    bytes,
    metadata,
    stats,
    warnings,
    previewDataUrl: preview.dataUrl,
    previewWidth: preview.width,
    previewHeight: preview.height,
    elevationGrid,
    gridWidth: preview.width,
    gridHeight: preview.height,
    contoursGeoJson
  };
}

function renderTerrainPreview(
  elevationGrid: Float64Array,
  width: number,
  height: number,
  metadata: GeotiffRasterMetadata,
  elevStats: ReturnType<typeof computeElevationStats>,
  options: {
    colormap: DemColormap;
    displayMode: DemDisplayMode;
    showContours: boolean;
    contourInterval: number;
    azimuth: number;
    altitude: number;
    zFactor: number;
    bounds: GeotiffBounds | null;
  }
): {
  dataUrl: string;
  contours: GeoJSON.FeatureCollection | null;
  contourCount: number;
} {
  const rendered = renderElevationDataUrl(elevationGrid, width, height, {
    colormap: options.colormap,
    displayMode: options.displayMode,
    stats: elevStats,
    nodata: metadata.nodata,
    azimuth: options.azimuth,
    altitude: options.altitude,
    zFactor: options.zFactor
  });

  let contours: GeoJSON.FeatureCollection | null = null;
  let contourCount = 0;
  if (options.showContours) {
    contours = extractContours(elevationGrid, width, height, {
      interval: options.contourInterval,
      nodata: metadata.nodata,
      bounds: options.bounds,
      maxLevels: TERRAIN_MAX_CONTOUR_LEVELS,
      stats: elevStats
    });
    const levels = new Set(
      contours.features.map((f) => f.properties?.['elevation']).filter((v) => v != null)
    );
    contourCount = levels.size;
    drawContoursOnCanvas(rendered.canvas, contours, options.bounds);
  }

  return {
    dataUrl: rendered.canvas.toDataURL('image/png'),
    contours,
    contourCount
  };
}

export async function openAndParseTerrain(
  bytes: Uint8Array,
  fileName: string,
  render: Partial<TerrainRenderOptions> = {}
): Promise<{
  metadata: GeotiffRasterMetadata;
  stats: TerrainDiagramStats;
  warnings: string[];
  preview: { dataUrl: string; width: number; height: number };
  elevationGrid: Float64Array;
  contoursGeoJson: GeoJSON.FeatureCollection | null;
  options: TerrainRenderOptions;
}> {
  const tiff = await fromArrayBuffer(uint8ToArrayBuffer(bytes));
  const metadata = await extractRasterMetadata(tiff, 0);
  const bandIndex = Math.min(
    Math.max(0, render.bandIndex ?? 0),
    Math.max(0, metadata.samplesPerPixel - 1)
  );
  const vizPreset: TerrainVizPreset = render.vizPreset ?? 'colored-relief';
  const fromPreset = vizPresetToDisplay(vizPreset);
  const showContours = render.showContours ?? fromPreset.showContours;
  const displayMode = render.displayMode ?? fromPreset.displayMode;
  const colormap: DemColormap = render.colormap ?? 'terrain';

  const { bands, width, height } = await readPreviewRasters(tiff, {
    maxPreviewSide: render.maxPreviewSide ?? TERRAIN_MAX_PREVIEW_SIDE,
    samples: [bandIndex]
  });
  const elevationGrid = copyElevationBand(bands[0]);
  const elevStats = computeElevationStats(elevationGrid, metadata.nodata);
  const bounds = bboxToBounds(metadata.bbox);
  const contourInterval =
    render.contourInterval ?? suggestContourInterval(elevStats, TERRAIN_MAX_CONTOUR_LEVELS);

  const options: TerrainRenderOptions = {
    colormap,
    displayMode,
    vizPreset,
    bandIndex,
    hillshadeAzimuth: render.hillshadeAzimuth ?? 315,
    hillshadeAltitude: render.hillshadeAltitude ?? 45,
    verticalExaggeration: render.verticalExaggeration ?? 1.5,
    showContours,
    contourInterval,
    opacity: render.opacity ?? 0.9,
    maxPreviewSide: render.maxPreviewSide ?? TERRAIN_MAX_PREVIEW_SIDE
  };

  const previewResult = renderTerrainPreview(
    elevationGrid,
    width,
    height,
    metadata,
    elevStats,
    {
      colormap: options.colormap,
      displayMode: options.displayMode,
      showContours: options.showContours,
      contourInterval: options.contourInterval,
      azimuth: options.hillshadeAzimuth,
      altitude: options.hillshadeAltitude,
      zFactor: options.verticalExaggeration,
      bounds
    }
  );

  const stats = buildTerrainStats(
    metadata,
    fileName,
    elevStats,
    bandIndex,
    width,
    height,
    options.contourInterval,
    previewResult.contourCount
  );
  const warnings = buildTerrainWarnings(metadata, elevStats);
  return {
    metadata,
    stats,
    warnings,
    preview: { dataUrl: previewResult.dataUrl, width, height },
    elevationGrid,
    contoursGeoJson: previewResult.contours,
    options
  };
}

export async function reRenderTerrainPreview(
  file: TerrainLoadedFile,
  render: Partial<TerrainRenderOptions>
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  elevationGrid: Float64Array;
  stats: TerrainDiagramStats;
  contoursGeoJson: GeoJSON.FeatureCollection | null;
}> {
  const bandIndex = Math.min(
    Math.max(0, render.bandIndex ?? file.stats.bandIndex),
    Math.max(0, file.metadata.samplesPerPixel - 1)
  );

  let elevationGrid = file.elevationGrid;
  let width = file.gridWidth;
  let height = file.gridHeight;

  if (bandIndex !== file.stats.bandIndex) {
    const tiff = await fromArrayBuffer(uint8ToArrayBuffer(file.bytes));
    const preview = await readPreviewRasters(tiff, {
      maxPreviewSide: render.maxPreviewSide ?? TERRAIN_MAX_PREVIEW_SIDE,
      samples: [bandIndex]
    });
    elevationGrid = copyElevationBand(preview.bands[0]);
    width = preview.width;
    height = preview.height;
  }

  const elevStats = computeElevationStats(elevationGrid, file.metadata.nodata);
  const bounds = bboxToBounds(file.metadata.bbox);
  const vizPreset = render.vizPreset ?? 'colored-relief';
  const fromPreset = vizPresetToDisplay(vizPreset);
  const showContours = render.showContours ?? fromPreset.showContours;
  const displayMode = render.displayMode ?? fromPreset.displayMode;
  const contourInterval =
    render.contourInterval ?? file.stats.contourInterval ?? suggestContourInterval(elevStats);

  const previewResult = renderTerrainPreview(
    elevationGrid,
    width,
    height,
    file.metadata,
    elevStats,
    {
      colormap: render.colormap ?? 'terrain',
      displayMode,
      showContours,
      contourInterval,
      azimuth: render.hillshadeAzimuth ?? 315,
      altitude: render.hillshadeAltitude ?? 45,
      zFactor: render.verticalExaggeration ?? 1.5,
      bounds
    }
  );

  const stats = buildTerrainStats(
    file.metadata,
    file.name,
    elevStats,
    bandIndex,
    width,
    height,
    contourInterval,
    previewResult.contourCount
  );

  return {
    dataUrl: previewResult.dataUrl,
    width,
    height,
    elevationGrid,
    stats,
    contoursGeoJson: previewResult.contours
  };
}

export function metadataRows(metadata: GeotiffRasterMetadata): TerrainMetadataRow[] {
  const rows: TerrainMetadataRow[] = [
    { key: 'width', value: String(metadata.width) },
    { key: 'height', value: String(metadata.height) },
    { key: 'samplesPerPixel', value: String(metadata.samplesPerPixel) },
    {
      key: 'bitsPerSample',
      value: Array.isArray(metadata.bitsPerSample)
        ? metadata.bitsPerSample.join(', ')
        : String(metadata.bitsPerSample)
    },
    { key: 'photometric', value: metadata.photometricLabel },
    { key: 'compression', value: metadata.compressionLabel },
    {
      key: 'bbox',
      value: metadata.bbox ? metadata.bbox.map((n) => n.toFixed(6)).join(', ') : '—'
    },
    { key: 'nodata', value: metadata.nodata == null ? '—' : String(metadata.nodata) },
    { key: 'crs', value: metadata.crsNote || '—' }
  ];
  return rows;
}

export function formatBounds(bounds: GeotiffBounds | null): string {
  if (!bounds) {
    return '—';
  }
  const fmt = (n: number) => n.toFixed(4);
  return `${fmt(bounds.west)}, ${fmt(bounds.south)} → ${fmt(bounds.east)}, ${fmt(bounds.north)}`;
}

export function exportMetadataJson(file: TerrainLoadedFile): string {
  return JSON.stringify(
    { file: { name: file.name, size: file.size }, metadata: file.metadata },
    null,
    2
  );
}

export function exportSummaryJson(file: TerrainLoadedFile): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      stats: file.stats,
      elevation: file.stats.elevation,
      contourInterval: file.stats.contourInterval,
      contourCount: file.stats.contourCount,
      warnings: file.warnings
    },
    null,
    2
  );
}

export function exportContoursGeoJson(file: TerrainLoadedFile): string {
  return JSON.stringify(
    file.contoursGeoJson ?? { type: 'FeatureCollection', features: [] },
    null,
    2
  );
}

export function canExportTerrain(file: TerrainLoadedFile | null): boolean {
  return !!file?.bytes?.length;
}

export function fitMapToTerrain(
  map: LeafletMap,
  L: LeafletModule,
  stats: TerrainDiagramStats
): void {
  const padding: [number, number] = [32, 32];
  if (stats.bounds) {
    const { west, south, east, north } = stats.bounds;
    const bounds = L.latLngBounds(L.latLng(south, west), L.latLng(north, east));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding });
      return;
    }
  }
  map.setView([20, 0], 2);
}

export function terrainImageBounds(
  L: LeafletModule,
  stats: TerrainDiagramStats
): LatLngBoundsExpression {
  if (stats.bounds) {
    const { west, south, east, north } = stats.bounds;
    return L.latLngBounds(L.latLng(south, west), L.latLng(north, east));
  }
  return L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));
}

export function createOrUpdateImageOverlay(
  L: LeafletModule,
  map: LeafletMap,
  dataUrl: string,
  stats: TerrainDiagramStats,
  opacity: number,
  existing: ImageOverlay | null
): ImageOverlay {
  const bounds = terrainImageBounds(L, stats);
  if (existing) {
    existing.setUrl(dataUrl);
    existing.setBounds(bounds as never);
    existing.setOpacity(opacity);
    return existing;
  }
  const overlay = L.imageOverlay(dataUrl, bounds, { opacity, interactive: false });
  overlay.addTo(map);
  return overlay;
}

export function resolveTerrainSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  hasBounds: boolean;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'terrain-error',
      title: 'Need a valid elevation GeoTIFF?',
      reason: 'Upload a DEM .tif for shaded relief and contours, or open DEM Viewer for height sampling.',
      actionLabel: 'Open DEM Viewer',
      path: '/gis-viewers/dem-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'terrain-intro',
      title: 'Start with a terrain GeoTIFF',
      reason: 'Drop an elevation .tif or load the sample to explore hillshade, contours, and relief tilt.',
      actionLabel: 'Related: DEM Viewer',
      path: '/gis-viewers/dem-viewer'
    };
  }
  if (!state.hasBounds) {
    return {
      id: 'terrain-nogeoref',
      title: 'Missing georeferencing',
      reason: 'This raster has no bbox. Contours and map overlay need georeferenced bounds.',
      actionLabel: 'Open GeoTIFF Viewer',
      path: '/gis-viewers/geotiff-viewer'
    };
  }
  return null;
}

export function bandOptions(samplesPerPixel: number): number[] {
  return Array.from({ length: Math.max(1, samplesPerPixel) }, (_, i) => i);
}

export type { Layer };
