import type { Map as LeafletMap, ImageOverlay, LatLngBoundsExpression, Layer } from 'leaflet';
import {
  CONTOUR_DEFAULT_MAJOR_EVERY,
  CONTOUR_DEM_EXTENSIONS,
  CONTOUR_GEOJSON_EXTENSIONS,
  CONTOUR_MAX_FILE_BYTES,
  CONTOUR_MAX_LABELS,
  CONTOUR_MAX_LEVELS,
  CONTOUR_MAX_PREVIEW_SIDE,
  CONTOUR_SAMPLE_BASE64,
  CONTOUR_SUPPORTED_EXTENSIONS
} from '../constants/contour-map-viewer.constants';
import type {
  ContourDiagramStats,
  ContourLabelPlacement,
  ContourLineColorMode,
  ContourLoadedFile,
  ContourMetadataRow,
  ContourRenderOptions,
  ContourSourceKind,
  DemColormap
} from '../types/contour-map-viewer.types';
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
  colormapRgb,
  computeElevationStats,
  copyElevationBand,
  drawContoursOnCanvas,
  extractContours,
  legendGradientCss,
  renderElevationDataUrl,
  suggestContourInterval
} from './dem-terrain.utils';

export {
  configureLeafletDefaultIcons,
  downloadBinaryFile,
  downloadTextFile,
  loadLeaflet,
  legendGradientCss,
  suggestContourInterval,
  extractContours,
  colormapRgb
};

type LeafletModule = typeof import('leaflet');

const ELEV_PROP_KEYS = ['elev', 'elevation', 'CONTOUR', 'contour', 'level', 'LEVEL', 'value'];

export function ensureContourStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'contourCss');
}

export function getContourFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function formatContourFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateContourFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > CONTOUR_MAX_FILE_BYTES) {
    return `File is too large (max ${formatContourFileSize(CONTOUR_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function sourceKindForExtension(ext: string): ContourSourceKind | null {
  if (CONTOUR_DEM_EXTENSIONS.includes(ext)) {
    return 'dem';
  }
  if (CONTOUR_GEOJSON_EXTENSIONS.includes(ext)) {
    return 'geojson';
  }
  return null;
}

export function filterValidContourFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  const seen = new Set<string>();

  for (const file of Array.from(files)) {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) {
      rejected.push({ name: file.name, reason: 'Duplicate file in this selection' });
      continue;
    }
    seen.add(key);

    const ext = getContourFileExtension(file.name);
    if (!CONTOUR_SUPPORTED_EXTENSIONS.includes(ext)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use elevation GeoTIFF or contour GeoJSON)'
      });
      continue;
    }
    const sizeError = validateContourFileSize(file);
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

/** Builds a sample DEM contours .tif File (lastModified: 0). */
export function createSampleContourFile(): File {
  const bytes = base64ToUint8Array(CONTOUR_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-contours.tif', {
    type: 'image/tiff',
    lastModified: 0
  });
}

export async function readContourFileBytes(file: File): Promise<Uint8Array> {
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
      reject(new Error('Failed to read contour file'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read contour file'));
    reader.readAsArrayBuffer(file);
  });
}

export async function readContourFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function elevationFromProperties(
  props: GeoJSON.GeoJsonProperties | null | undefined
): number | null {
  if (!props || typeof props !== 'object') {
    return null;
  }
  for (const key of ELEV_PROP_KEYS) {
    const raw = (props as Record<string, unknown>)[key];
    if (raw == null || raw === '') {
      continue;
    }
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(num)) {
      return num;
    }
  }
  return null;
}

function lineStringCoords(geometry: GeoJSON.Geometry): number[][][] {
  if (geometry.type === 'LineString') {
    return [geometry.coordinates as number[][]];
  }
  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates as number[][][];
  }
  return [];
}

export function parseContourGeoJson(text: string): {
  contours: GeoJSON.FeatureCollection;
  elevation: ReturnType<typeof computeElevationStats>;
  hasElevationProps: boolean;
  bounds: GeotiffBounds | null;
} {
  if (!text || !text.trim()) {
    throw new Error('GeoJSON file is empty');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON — could not parse contour GeoJSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Contour GeoJSON must be an object');
  }
  const root = parsed as GeoJSON.GeoJSON;
  let features: GeoJSON.Feature[] = [];
  if (root.type === 'FeatureCollection') {
    features = Array.isArray(root.features) ? root.features : [];
  } else if (root.type === 'Feature') {
    features = [root];
  } else if (root.type === 'LineString' || root.type === 'MultiLineString') {
    features = [{ type: 'Feature', properties: {}, geometry: root }];
  } else {
    throw new Error('Expected a FeatureCollection of LineString / MultiLineString contours');
  }

  const lineFeatures: GeoJSON.Feature[] = [];
  const elevValues: number[] = [];
  let hasElevationProps = false;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let foundBounds = false;

  for (const feature of features) {
    if (!feature?.geometry) {
      continue;
    }
    const rings = lineStringCoords(feature.geometry);
    if (rings.length === 0) {
      continue;
    }
    const elev = elevationFromProperties(feature.properties);
    if (elev != null) {
      hasElevationProps = true;
      elevValues.push(elev);
    }
    for (const ring of rings) {
      for (const coord of ring) {
        const lng = coord[0];
        const lat = coord[1];
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          continue;
        }
        west = Math.min(west, lng);
        east = Math.max(east, lng);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
        foundBounds = true;
      }
    }
    lineFeatures.push({
      type: 'Feature',
      properties: {
        ...(feature.properties || {}),
        elevation: elev
      },
      geometry: feature.geometry
    });
  }

  if (lineFeatures.length === 0) {
    throw new Error('No LineString or MultiLineString features found in GeoJSON');
  }

  const elevation =
    elevValues.length > 0
      ? computeElevationStats(elevValues)
      : { min: 0, max: 0, mean: 0, range: 0, validCount: 0 };

  return {
    contours: { type: 'FeatureCollection', features: lineFeatures },
    elevation,
    hasElevationProps,
    bounds: foundBounds ? { west, south, east, north } : null
  };
}

export function uniqueContourLevels(contours: GeoJSON.FeatureCollection): number[] {
  const levels = new Set<number>();
  for (const feature of contours.features) {
    const elev = elevationFromProperties(feature.properties);
    if (elev != null) {
      levels.add(elev);
    }
  }
  return Array.from(levels).sort((a, b) => a - b);
}

export function isMajorContourLevel(
  elevation: number,
  interval: number,
  majorEvery: number,
  levels: number[]
): boolean {
  if (majorEvery <= 1 || levels.length === 0) {
    return true;
  }
  const index = levels.findIndex((level) => Math.abs(level - elevation) < interval * 1e-6);
  if (index < 0) {
    return Math.abs(Math.round(elevation / (interval * majorEvery)) * interval * majorEvery - elevation) <
      interval * 1e-6;
  }
  return index % majorEvery === 0;
}

export function pickContourLabels(
  contours: GeoJSON.FeatureCollection,
  options: {
    interval: number;
    majorEvery: number;
    maxLabels?: number;
  }
): ContourLabelPlacement[] {
  const maxLabels = options.maxLabels ?? CONTOUR_MAX_LABELS;
  const levels = uniqueContourLevels(contours);
  const byLevel = new Map<number, ContourLabelPlacement>();

  for (const feature of contours.features) {
    const elev = elevationFromProperties(feature.properties);
    if (elev == null || !feature.geometry) {
      continue;
    }
    const rings = lineStringCoords(feature.geometry);
    for (const ring of rings) {
      if (ring.length < 2) {
        continue;
      }
      const mid = ring[Math.floor(ring.length / 2)];
      const lng = mid[0];
      const lat = mid[1];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }
      if (!byLevel.has(elev)) {
        byLevel.set(elev, {
          lat,
          lng,
          elevation: elev,
          isMajor: isMajorContourLevel(elev, options.interval, options.majorEvery, levels)
        });
      }
    }
  }

  const placements = Array.from(byLevel.values()).sort((a, b) => a.elevation - b.elevation);
  if (placements.length <= maxLabels) {
    return placements;
  }
  const step = placements.length / maxLabels;
  const sampled: ContourLabelPlacement[] = [];
  for (let i = 0; i < maxLabels; i++) {
    sampled.push(placements[Math.min(placements.length - 1, Math.floor(i * step))]);
  }
  return sampled;
}

export function strokeStyleForElevation(
  elevation: number | null,
  stats: ReturnType<typeof computeElevationStats>,
  mode: ContourLineColorMode,
  solidColor: string,
  colormap: DemColormap,
  isMajor: boolean
): string {
  if (mode === 'solid' || elevation == null || stats.range <= 0) {
    return solidColor;
  }
  const t = (elevation - stats.min) / stats.range;
  const [r, g, b] = colormapRgb(colormap, t);
  const alpha = isMajor ? 0.95 : 0.7;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawColoredContoursOnCanvas(
  canvas: HTMLCanvasElement,
  contours: GeoJSON.FeatureCollection,
  bounds: GeotiffBounds | null,
  options: {
    stats: ReturnType<typeof computeElevationStats>;
    interval: number;
    majorEvery: number;
    lineColorMode: ContourLineColorMode;
    solidColor: string;
    colormap: DemColormap;
    lineWeight: number;
  }
): void {
  if (!bounds) {
    drawContoursOnCanvas(canvas, contours, bounds, options.solidColor);
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  const { width, height } = canvas;
  const { west, south, east, north } = bounds;
  const toX = (lng: number) => ((lng - west) / (east - west)) * (width - 1);
  const toY = (lat: number) => ((north - lat) / (north - south)) * (height - 1);
  const levels = uniqueContourLevels(contours);

  ctx.save();
  for (const feature of contours.features) {
    if (!feature.geometry) {
      continue;
    }
    const elev = elevationFromProperties(feature.properties);
    const isMajor =
      elev != null
        ? isMajorContourLevel(elev, options.interval, options.majorEvery, levels)
        : false;
    const rings = lineStringCoords(feature.geometry);
    ctx.strokeStyle = strokeStyleForElevation(
      elev,
      options.stats,
      options.lineColorMode,
      options.solidColor,
      options.colormap,
      isMajor
    );
    ctx.lineWidth = isMajor ? options.lineWeight * 1.6 : options.lineWeight;
    for (const ring of rings) {
      if (ring.length < 2) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(toX(ring[0][0]), toY(ring[0][1]));
      for (let i = 1; i < ring.length; i++) {
        ctx.lineTo(toX(ring[i][0]), toY(ring[i][1]));
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function buildContourWarnings(state: {
  sourceKind: ContourSourceKind;
  elevation: ReturnType<typeof computeElevationStats>;
  contourCount: number;
  hasElevationProps?: boolean;
  hasBounds: boolean;
}): string[] {
  const warnings: string[] = [];
  if (!state.hasBounds) {
    warnings.push('No georeferencing found — overlay will use a default world view.');
  }
  if (state.sourceKind === 'dem' && state.elevation.validCount === 0) {
    warnings.push('No valid elevation samples found (all nodata or empty).');
  } else if (state.sourceKind === 'dem' && state.elevation.range === 0) {
    warnings.push('Flat DEM — elevation is constant; contours may be empty.');
  }
  if (state.contourCount > CONTOUR_MAX_LEVELS * 0.85) {
    warnings.push(
      `Many contour levels (${state.contourCount}) — increase the interval for a cleaner map.`
    );
  }
  if (state.sourceKind === 'geojson' && state.hasElevationProps === false) {
    warnings.push(
      'GeoJSON contours lack elev/elevation/CONTOUR/level properties — labels and color-by-elevation are limited.'
    );
  }
  return warnings;
}

export function buildContourStats(
  fileName: string,
  sourceKind: ContourSourceKind,
  elevation: ReturnType<typeof computeElevationStats>,
  options: {
    width: number;
    height: number;
    samplesPerPixel: number;
    bitsPerSampleLabel: string;
    bounds: GeotiffBounds | null;
    nodata: number | null;
    crsNote: string | null;
    bandIndex: number;
    previewWidth: number;
    previewHeight: number;
    contourInterval: number;
    contourCount: number;
    featureCount: number;
    majorEvery: number;
  }
): ContourDiagramStats {
  return {
    title: fileName.replace(/\.(tif|tiff|geotiff|geojson|json)$/i, '') || 'Contours',
    sourceKind,
    width: options.width,
    height: options.height,
    samplesPerPixel: options.samplesPerPixel,
    bitsPerSampleLabel: options.bitsPerSampleLabel,
    bounds: options.bounds,
    nodata: options.nodata,
    crsNote: options.crsNote,
    elevation,
    bandIndex: options.bandIndex,
    previewWidth: options.previewWidth,
    previewHeight: options.previewHeight,
    contourInterval: options.contourInterval,
    contourCount: options.contourCount,
    featureCount: options.featureCount,
    majorEvery: options.majorEvery
  };
}

export function createContourFileRecord(
  file: File,
  sourceKind: ContourSourceKind,
  bytes: Uint8Array,
  text: string | null,
  metadata: GeotiffRasterMetadata | null,
  stats: ContourDiagramStats,
  warnings: string[],
  preview: { dataUrl: string | null; width: number; height: number },
  elevationGrid: Float64Array | null,
  contoursGeoJson: GeoJSON.FeatureCollection
): ContourLoadedFile {
  return {
    id: `${file.name}|${file.size}|${file.lastModified}`,
    name: file.name,
    size: file.size,
    sourceKind,
    bytes,
    text,
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

function renderContourCanvas(
  elevationGrid: Float64Array | null,
  width: number,
  height: number,
  contours: GeoJSON.FeatureCollection,
  elevStats: ReturnType<typeof computeElevationStats>,
  bounds: GeotiffBounds | null,
  nodata: number | null,
  options: ContourRenderOptions
): string {
  const canvas =
    typeof document !== 'undefined'
      ? document.createElement('canvas')
      : (null as unknown as HTMLCanvasElement);
  if (!canvas) {
    return '';
  }
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  if (options.showUnderlay && elevationGrid) {
    const rendered = renderElevationDataUrl(elevationGrid, width, height, {
      colormap: options.colormap,
      displayMode: 'hillshade',
      stats: elevStats,
      nodata,
      azimuth: 315,
      altitude: 45,
      zFactor: 1
    });
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.globalAlpha = 0.45;
      ctx.drawImage(rendered.canvas, 0, 0);
      ctx.globalAlpha = 1;
    }
  } else {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  drawColoredContoursOnCanvas(canvas, contours, bounds, {
    stats: elevStats,
    interval: options.contourInterval,
    majorEvery: options.majorEvery,
    lineColorMode: options.lineColorMode,
    solidColor: options.solidColor,
    colormap: options.colormap,
    lineWeight: options.lineWeight
  });

  return canvas.toDataURL('image/png');
}

export async function openAndParseContourDem(
  bytes: Uint8Array,
  fileName: string,
  render: Partial<ContourRenderOptions> = {}
): Promise<{
  metadata: GeotiffRasterMetadata;
  stats: ContourDiagramStats;
  warnings: string[];
  preview: { dataUrl: string; width: number; height: number };
  elevationGrid: Float64Array;
  contoursGeoJson: GeoJSON.FeatureCollection;
  options: ContourRenderOptions;
}> {
  const tiff = await fromArrayBuffer(uint8ToArrayBuffer(bytes));
  const metadata = await extractRasterMetadata(tiff, 0);
  const bandIndex = Math.min(
    Math.max(0, render.bandIndex ?? 0),
    Math.max(0, metadata.samplesPerPixel - 1)
  );
  const { bands, width, height } = await readPreviewRasters(tiff, {
    maxPreviewSide: render.maxPreviewSide ?? CONTOUR_MAX_PREVIEW_SIDE,
    samples: [bandIndex]
  });
  const elevationGrid = copyElevationBand(bands[0]);
  const elevStats = computeElevationStats(elevationGrid, metadata.nodata);
  const bounds = bboxToBounds(metadata.bbox);
  const contourInterval =
    render.contourInterval ?? suggestContourInterval(elevStats, CONTOUR_MAX_LEVELS);
  const majorEvery = render.majorEvery ?? CONTOUR_DEFAULT_MAJOR_EVERY;

  const options: ContourRenderOptions = {
    colormap: render.colormap ?? 'terrain',
    bandIndex,
    contourInterval,
    majorEvery,
    showLabels: render.showLabels ?? true,
    showUnderlay: render.showUnderlay ?? true,
    lineColorMode: render.lineColorMode ?? 'elevation',
    solidColor: render.solidColor ?? '#1e293b',
    lineWeight: render.lineWeight ?? 1.25,
    opacity: render.opacity ?? 0.95,
    maxPreviewSide: render.maxPreviewSide ?? CONTOUR_MAX_PREVIEW_SIDE
  };

  const contours = extractContours(elevationGrid, width, height, {
    interval: options.contourInterval,
    nodata: metadata.nodata,
    bounds,
    maxLevels: CONTOUR_MAX_LEVELS,
    stats: elevStats
  });
  const contourCount = uniqueContourLevels(contours).length;
  const dataUrl = renderContourCanvas(
    elevationGrid,
    width,
    height,
    contours,
    elevStats,
    bounds,
    metadata.nodata,
    options
  );

  const stats = buildContourStats(fileName, 'dem', elevStats, {
    width: metadata.width,
    height: metadata.height,
    samplesPerPixel: metadata.samplesPerPixel,
    bitsPerSampleLabel: bitsPerSampleLabel(metadata.bitsPerSample),
    bounds,
    nodata: metadata.nodata,
    crsNote: metadata.crsNote,
    bandIndex,
    previewWidth: width,
    previewHeight: height,
    contourInterval: options.contourInterval,
    contourCount,
    featureCount: contours.features.length,
    majorEvery: options.majorEvery
  });
  const warnings = buildContourWarnings({
    sourceKind: 'dem',
    elevation: elevStats,
    contourCount,
    hasBounds: !!bounds
  });

  return {
    metadata,
    stats,
    warnings,
    preview: { dataUrl, width, height },
    elevationGrid,
    contoursGeoJson: contours,
    options
  };
}

export function openAndParseContourGeoJson(
  text: string,
  fileName: string,
  render: Partial<ContourRenderOptions> = {}
): {
  stats: ContourDiagramStats;
  warnings: string[];
  preview: { dataUrl: string; width: number; height: number };
  contoursGeoJson: GeoJSON.FeatureCollection;
  options: ContourRenderOptions;
} {
  const parsed = parseContourGeoJson(text);
  const levels = uniqueContourLevels(parsed.contours);
  const intervalGuess =
    levels.length >= 2
      ? Math.max(1e-6, Math.abs(levels[1] - levels[0]))
      : suggestContourInterval(parsed.elevation, CONTOUR_MAX_LEVELS);
  const options: ContourRenderOptions = {
    colormap: render.colormap ?? 'terrain',
    bandIndex: 0,
    contourInterval: render.contourInterval ?? intervalGuess,
    majorEvery: render.majorEvery ?? CONTOUR_DEFAULT_MAJOR_EVERY,
    showLabels: render.showLabels ?? true,
    showUnderlay: false,
    lineColorMode: render.lineColorMode ?? 'elevation',
    solidColor: render.solidColor ?? '#1e293b',
    lineWeight: render.lineWeight ?? 1.25,
    opacity: render.opacity ?? 0.95
  };

  const width = 512;
  const height = 512;
  const dataUrl = renderContourCanvas(
    null,
    width,
    height,
    parsed.contours,
    parsed.elevation,
    parsed.bounds,
    null,
    options
  );

  const stats = buildContourStats(fileName, 'geojson', parsed.elevation, {
    width,
    height,
    samplesPerPixel: 0,
    bitsPerSampleLabel: '—',
    bounds: parsed.bounds,
    nodata: null,
    crsNote: null,
    bandIndex: 0,
    previewWidth: width,
    previewHeight: height,
    contourInterval: options.contourInterval,
    contourCount: levels.length,
    featureCount: parsed.contours.features.length,
    majorEvery: options.majorEvery
  });
  const warnings = buildContourWarnings({
    sourceKind: 'geojson',
    elevation: parsed.elevation,
    contourCount: levels.length,
    hasElevationProps: parsed.hasElevationProps,
    hasBounds: !!parsed.bounds
  });

  return {
    stats,
    warnings,
    preview: { dataUrl, width, height },
    contoursGeoJson: parsed.contours,
    options
  };
}

export async function reRenderContourPreview(
  file: ContourLoadedFile,
  render: Partial<ContourRenderOptions>
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  elevationGrid: Float64Array | null;
  stats: ContourDiagramStats;
  contoursGeoJson: GeoJSON.FeatureCollection;
}> {
  const options: ContourRenderOptions = {
    colormap: render.colormap ?? 'terrain',
    bandIndex: render.bandIndex ?? file.stats.bandIndex,
    contourInterval: render.contourInterval ?? file.stats.contourInterval,
    majorEvery: render.majorEvery ?? file.stats.majorEvery,
    showLabels: render.showLabels ?? true,
    showUnderlay: render.showUnderlay ?? file.sourceKind === 'dem',
    lineColorMode: render.lineColorMode ?? 'elevation',
    solidColor: render.solidColor ?? '#1e293b',
    lineWeight: render.lineWeight ?? 1.25,
    opacity: render.opacity ?? 0.95,
    maxPreviewSide: render.maxPreviewSide ?? CONTOUR_MAX_PREVIEW_SIDE
  };

  if (file.sourceKind === 'dem' && file.bytes.length) {
    const parsed = await openAndParseContourDem(file.bytes, file.name, options);
    return {
      dataUrl: parsed.preview.dataUrl,
      width: parsed.preview.width,
      height: parsed.preview.height,
      elevationGrid: parsed.elevationGrid,
      stats: parsed.stats,
      contoursGeoJson: parsed.contoursGeoJson
    };
  }

  const width = file.previewWidth || 512;
  const height = file.previewHeight || 512;
  const dataUrl = renderContourCanvas(
    null,
    width,
    height,
    file.contoursGeoJson,
    file.stats.elevation,
    file.stats.bounds,
    null,
    options
  );
  const levels = uniqueContourLevels(file.contoursGeoJson);
  const stats = {
    ...file.stats,
    contourInterval: options.contourInterval,
    majorEvery: options.majorEvery,
    contourCount: levels.length
  };
  return {
    dataUrl,
    width,
    height,
    elevationGrid: null,
    stats,
    contoursGeoJson: file.contoursGeoJson
  };
}

export function metadataRows(file: ContourLoadedFile): ContourMetadataRow[] {
  if (file.metadata) {
    const metadata = file.metadata;
    return [
      { key: 'source', value: 'DEM GeoTIFF' },
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
      { key: 'crs', value: metadata.crsNote || '—' },
      { key: 'contourLevels', value: String(file.stats.contourCount) },
      { key: 'contourFeatures', value: String(file.stats.featureCount) }
    ];
  }
  return [
    { key: 'source', value: 'Contour GeoJSON' },
    { key: 'contourLevels', value: String(file.stats.contourCount) },
    { key: 'contourFeatures', value: String(file.stats.featureCount) },
    {
      key: 'bbox',
      value: file.stats.bounds
        ? `${file.stats.bounds.west.toFixed(4)}, ${file.stats.bounds.south.toFixed(4)} → ${file.stats.bounds.east.toFixed(4)}, ${file.stats.bounds.north.toFixed(4)}`
        : '—'
    }
  ];
}

export function formatBounds(bounds: GeotiffBounds | null): string {
  if (!bounds) {
    return '—';
  }
  const fmt = (n: number) => n.toFixed(4);
  return `${fmt(bounds.west)}, ${fmt(bounds.south)} → ${fmt(bounds.east)}, ${fmt(bounds.north)}`;
}

export function exportSummaryJson(file: ContourLoadedFile): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size, sourceKind: file.sourceKind },
      stats: file.stats,
      elevation: file.stats.elevation,
      warnings: file.warnings
    },
    null,
    2
  );
}

export function exportContoursGeoJson(file: ContourLoadedFile): string {
  return JSON.stringify(file.contoursGeoJson, null, 2);
}

export function canExportContour(file: ContourLoadedFile | null): boolean {
  return !!file && file.contoursGeoJson.features.length >= 0;
}

export function canExportOriginalDem(file: ContourLoadedFile | null): boolean {
  return !!file && file.sourceKind === 'dem' && file.bytes.length > 0;
}

export function fitMapToContour(
  map: LeafletMap,
  L: LeafletModule,
  stats: ContourDiagramStats
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

export function contourImageBounds(
  L: LeafletModule,
  stats: ContourDiagramStats
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
  stats: ContourDiagramStats,
  opacity: number,
  existing: ImageOverlay | null
): ImageOverlay {
  const bounds = contourImageBounds(L, stats);
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

export function nearestContourElevation(
  contours: GeoJSON.FeatureCollection,
  lat: number,
  lng: number,
  maxDistDeg = 0.02
): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const feature of contours.features) {
    if (!feature.geometry) {
      continue;
    }
    const elev = elevationFromProperties(feature.properties);
    if (elev == null) {
      continue;
    }
    for (const ring of lineStringCoords(feature.geometry)) {
      for (const coord of ring) {
        const dLng = coord[0] - lng;
        const dLat = coord[1] - lat;
        const dist = Math.sqrt(dLng * dLng + dLat * dLat);
        if (dist < bestDist) {
          bestDist = dist;
          best = elev;
        }
      }
    }
  }
  return bestDist <= maxDistDeg ? best : null;
}

export function resolveContourSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  hasBounds: boolean;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'contour-error',
      title: 'Need elevation or contour data?',
      reason: 'Upload a DEM GeoTIFF or precomputed contour GeoJSON, or try Terrain Viewer for relief.',
      actionLabel: 'Open Terrain Viewer',
      path: '/gis-viewers/terrain-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'contour-intro',
      title: 'Start with a DEM or contour GeoJSON',
      reason: 'Drop an elevation .tif to generate isolines, or load precomputed LineString contours.',
      actionLabel: 'Related: DEM Viewer',
      path: '/gis-viewers/dem-viewer'
    };
  }
  if (!state.hasBounds) {
    return {
      id: 'contour-nogeoref',
      title: 'Missing georeferencing',
      reason: 'Contours need geographic bounds to place correctly on the map.',
      actionLabel: 'Open GeoJSON Viewer',
      path: '/gis-viewers/geojson-viewer'
    };
  }
  return null;
}

export function bandOptions(samplesPerPixel: number): number[] {
  return Array.from({ length: Math.max(1, samplesPerPixel) }, (_, i) => i);
}

export type { Layer };
