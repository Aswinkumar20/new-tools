import type { ImageOverlay, LatLngBoundsExpression, Map as LeafletMap } from 'leaflet';
import {
  RASTER_MAP_MAX_FILE_BYTES,
  RASTER_MAP_MAX_PREVIEW_SIDE,
  RASTER_MAP_SAMPLE_ASC,
  RASTER_MAP_SUPPORTED_EXTENSIONS
} from '../constants/raster-map-viewer.constants';
import type {
  RasterMapColormap,
  RasterMapDiagramStats,
  RasterMapLoadedFile,
  RasterMapMetadataRow,
  RasterMapRenderOptions,
  RasterMapSourceKind,
  RasterMapStretchMode,
  RasterMapValueStats
} from '../types/raster-map-viewer.types';
import type { GeotiffBounds, GeotiffRasterMetadata } from '../types/geotiff-viewer.types';
import { downsampleAsciiGrid, parseAsciiGrid } from './ascii-grid.utils';
import {
  colormapRgb,
  computeElevationStats,
  legendGradientCss as demLegendGradientCss
} from './dem-terrain.utils';
import {
  bitsPerSampleLabel,
  bboxToBounds,
  buildRgbaCanvas,
  canvasToDataUrl,
  downloadBinaryFile,
  extractRasterMetadata,
  fromArrayBuffer,
  readPreviewRasters,
  scaleToByte,
  stretchValues,
  uint8ToArrayBuffer
} from './geotiff-raster.utils';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';

export {
  configureLeafletDefaultIcons,
  downloadBinaryFile,
  downloadTextFile,
  loadLeaflet
};

type LeafletModule = typeof import('leaflet');

const TURBO_STOPS: Array<[number, number, number, number]> = [
  [0, 35, 23, 27],
  [0.1, 48, 18, 59],
  [0.2, 68, 81, 191],
  [0.35, 40, 170, 226],
  [0.5, 26, 228, 122],
  [0.65, 145, 251, 40],
  [0.8, 237, 200, 19],
  [0.9, 250, 100, 8],
  [1, 144, 12, 0]
];

function lerpTurbo(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 0; i < TURBO_STOPS.length - 1; i++) {
    const a = TURBO_STOPS[i];
    const b = TURBO_STOPS[i + 1];
    if (x >= a[0] && x <= b[0]) {
      const u = (x - a[0]) / (b[0] - a[0] || 1);
      return [
        Math.round(a[1] + (b[1] - a[1]) * u),
        Math.round(a[2] + (b[2] - a[2]) * u),
        Math.round(a[3] + (b[3] - a[3]) * u)
      ];
    }
  }
  const last = TURBO_STOPS[TURBO_STOPS.length - 1];
  return [last[1], last[2], last[3]];
}

export function rasterColormapRgb(
  colormap: RasterMapColormap,
  t: number
): [number, number, number] {
  if (colormap === 'turbo') {
    return lerpTurbo(t);
  }
  if (colormap === 'grayscale' || colormap === 'viridis' || colormap === 'terrain') {
    return colormapRgb(colormap, t);
  }
  return lerpTurbo(t);
}

export function rasterLegendGradientCss(colormap: RasterMapColormap): string {
  if (colormap === 'turbo') {
    const parts = TURBO_STOPS.map(
      ([p, r, g, b]) => `rgb(${r},${g},${b}) ${(p * 100).toFixed(0)}%`
    );
    return `linear-gradient(90deg, ${parts.join(', ')})`;
  }
  return demLegendGradientCss(colormap);
}

export function ensureRasterMapStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'rasterMapCss');
}

export function getRasterMapFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function formatRasterMapFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateRasterMapFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > RASTER_MAP_MAX_FILE_BYTES) {
    return `File is too large (max ${formatRasterMapFileSize(RASTER_MAP_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidRasterMapFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const file of Array.from(files)) {
    const ext = getRasterMapFileExtension(file.name);
    if (!RASTER_MAP_SUPPORTED_EXTENSIONS.includes(ext)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .tif, .tiff, .geotiff, or .asc)'
      });
      continue;
    }
    const sizeError = validateRasterMapFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleRasterMapFile(): File {
  return new File([RASTER_MAP_SAMPLE_ASC], 'sample-raster.asc', {
    type: 'text/plain',
    lastModified: 0
  });
}

export async function readRasterMapFileBytes(file: File): Promise<Uint8Array> {
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
      reject(new Error('Failed to read raster file'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read raster file'));
    reader.readAsArrayBuffer(file);
  });
}

function toValueStats(
  elev: ReturnType<typeof computeElevationStats>
): RasterMapValueStats {
  return {
    min: elev.min,
    max: elev.max,
    mean: elev.mean,
    range: elev.range,
    validCount: elev.validCount
  };
}

export function buildColormapCanvas(
  values: ArrayLike<number>,
  width: number,
  height: number,
  options: {
    colormap: RasterMapColormap;
    stretch: RasterMapStretchMode;
    nodata: number | null;
  }
): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    throw new Error('Canvas is only available in the browser');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create 2D canvas context');
  }
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const { min, max } = stretchValues(values, options.stretch, options.nodata);
  const range = max - min || 1;
  for (let i = 0; i < width * height; i++) {
    const v = values[i];
    const o = i * 4;
    if (!Number.isFinite(v) || (options.nodata != null && v === options.nodata)) {
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 0;
      continue;
    }
    let t: number;
    if (options.stretch === 'none') {
      t = Math.max(0, Math.min(1, scaleToByte(v, 0, 255) / 255));
    } else {
      t = Math.max(0, Math.min(1, (v - min) / range));
    }
    const [r, g, b] = rasterColormapRgb(options.colormap, t);
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function buildRasterWarnings(
  sourceKind: RasterMapSourceKind,
  bounds: GeotiffBounds | null,
  values: RasterMapValueStats,
  width: number,
  height: number,
  extra: string[] = []
): string[] {
  const warnings = [...extra];
  if (!bounds) {
    warnings.push('No georeferencing found — overlay will use a default world view.');
  }
  if (values.validCount === 0) {
    warnings.push('No valid samples found (all nodata or empty).');
  }
  if (Math.max(width, height) > 4096) {
    warnings.push(
      `Large grid (${width}×${height}). Preview is downsampled for performance.`
    );
  }
  if (sourceKind === 'asc' && values.range === 0 && values.validCount > 0) {
    warnings.push('Flat raster — all valid cells share the same value.');
  }
  return warnings;
}

export function buildRasterStats(params: {
  fileName: string;
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
  stretch: RasterMapStretchMode;
  colormap: RasterMapColormap;
  displayMode: 'colormap' | 'rgb';
}): RasterMapDiagramStats {
  return {
    title: params.fileName.replace(/\.(tif|tiff|geotiff|asc)$/i, '') || 'Raster',
    width: params.width,
    height: params.height,
    samplesPerPixel: params.samplesPerPixel,
    cellSize: params.cellSize,
    nodata: params.nodata,
    bounds: params.bounds,
    crsNote: params.crsNote,
    values: params.values,
    bandIndex: params.bandIndex,
    previewWidth: params.previewWidth,
    previewHeight: params.previewHeight,
    sourceKind: params.sourceKind,
    displayMode: params.displayMode,
    stretch: params.stretch,
    colormap: params.colormap
  };
}

export function createRasterMapFileRecord(
  file: File,
  bytes: Uint8Array,
  sourceKind: RasterMapSourceKind,
  metadata: GeotiffRasterMetadata | null,
  stats: RasterMapDiagramStats,
  warnings: string[],
  preview: { dataUrl: string; width: number; height: number },
  valueGrid: Float64Array,
  ascText: string | null
): RasterMapLoadedFile {
  return {
    id: `${file.name}|${file.size}|${file.lastModified}`,
    name: file.name,
    size: file.size,
    bytes,
    sourceKind,
    metadata,
    stats,
    warnings,
    previewDataUrl: preview.dataUrl,
    previewWidth: preview.width,
    previewHeight: preview.height,
    valueGrid,
    gridWidth: preview.width,
    gridHeight: preview.height,
    ascText
  };
}

export async function openAndParseRasterAsc(
  text: string,
  fileName: string,
  render: Partial<RasterMapRenderOptions> = {}
): Promise<{
  metadata: null;
  stats: RasterMapDiagramStats;
  warnings: string[];
  preview: { dataUrl: string; width: number; height: number };
  valueGrid: Float64Array;
  options: RasterMapRenderOptions;
}> {
  const parsed = parseAsciiGrid(text);
  const maxSide = render.maxPreviewSide ?? RASTER_MAP_MAX_PREVIEW_SIDE;
  const down = downsampleAsciiGrid(
    parsed.values,
    parsed.header.ncols,
    parsed.header.nrows,
    maxSide
  );
  const elev = computeElevationStats(down.values, parsed.header.nodata);
  const values = toValueStats(elev);
  const colormap: RasterMapColormap = render.colormap ?? 'viridis';
  const stretch: RasterMapStretchMode = render.stretch ?? 'minmax';
  const canvas = buildColormapCanvas(down.values, down.width, down.height, {
    colormap,
    stretch,
    nodata: parsed.header.nodata
  });
  const bounds = parsed.bounds;
  const stats = buildRasterStats({
    fileName,
    width: parsed.header.ncols,
    height: parsed.header.nrows,
    samplesPerPixel: 1,
    cellSize: parsed.header.cellsize,
    nodata: parsed.header.nodata,
    bounds,
    crsNote: bounds ? 'ASCII Grid geographic extents (assumed WGS84-like degrees)' : null,
    values,
    bandIndex: 0,
    previewWidth: down.width,
    previewHeight: down.height,
    sourceKind: 'asc',
    stretch,
    colormap,
    displayMode: 'colormap'
  });
  const warnings = buildRasterWarnings(
    'asc',
    bounds,
    values,
    parsed.header.ncols,
    parsed.header.nrows,
    [
      ...parsed.warnings,
      ...(down.downsampled ? ['Preview downsampled for performance.'] : [])
    ]
  );
  const options: RasterMapRenderOptions = {
    stretch,
    colormap,
    bandIndex: 0,
    opacity: render.opacity ?? 0.9,
    rgbMode: false,
    red: 0,
    green: 0,
    blue: 0,
    maxPreviewSide: maxSide
  };
  return {
    metadata: null,
    stats,
    warnings,
    preview: { dataUrl: canvasToDataUrl(canvas), width: down.width, height: down.height },
    valueGrid: down.values,
    options
  };
}

export async function openAndParseRasterGeotiff(
  bytes: Uint8Array,
  fileName: string,
  render: Partial<RasterMapRenderOptions> = {}
): Promise<{
  metadata: GeotiffRasterMetadata;
  stats: RasterMapDiagramStats;
  warnings: string[];
  preview: { dataUrl: string; width: number; height: number };
  valueGrid: Float64Array;
  options: RasterMapRenderOptions;
}> {
  const tiff = await fromArrayBuffer(uint8ToArrayBuffer(bytes));
  const metadata = await extractRasterMetadata(tiff, 0);
  const samples = metadata.samplesPerPixel;
  const wantRgb = (render.rgbMode ?? samples >= 3) && samples >= 3;
  const bandIndex = Math.min(
    Math.max(0, render.bandIndex ?? 0),
    Math.max(0, samples - 1)
  );
  const stretch: RasterMapStretchMode = render.stretch ?? 'minmax';
  const colormap: RasterMapColormap = render.colormap ?? 'viridis';
  const maxSide = render.maxPreviewSide ?? RASTER_MAP_MAX_PREVIEW_SIDE;

  let dataUrl: string;
  let width: number;
  let height: number;
  let valueGrid: Float64Array;

  if (wantRgb) {
    const red = Math.min(Math.max(0, render.red ?? 0), samples - 1);
    const green = Math.min(Math.max(0, render.green ?? 1), samples - 1);
    const blue = Math.min(Math.max(0, render.blue ?? 2), samples - 1);
    const preview = await readPreviewRasters(tiff, {
      maxPreviewSide: maxSide,
      samples: [red, green, blue]
    });
    width = preview.width;
    height = preview.height;
    const canvas = buildRgbaCanvas(preview.bands, width, height, {
      selection: { red: 0, green: 1, blue: 2, grayscale: false },
      stretch,
      nodata: metadata.nodata
    });
    dataUrl = canvasToDataUrl(canvas);
    valueGrid = Float64Array.from(preview.bands[0] as ArrayLike<number>);
  } else {
    const preview = await readPreviewRasters(tiff, {
      maxPreviewSide: maxSide,
      samples: [bandIndex]
    });
    width = preview.width;
    height = preview.height;
    valueGrid = Float64Array.from(preview.bands[0] as ArrayLike<number>);
    const canvas = buildColormapCanvas(valueGrid, width, height, {
      colormap,
      stretch,
      nodata: metadata.nodata
    });
    dataUrl = canvasToDataUrl(canvas);
  }

  const elev = computeElevationStats(valueGrid, metadata.nodata);
  const values = toValueStats(elev);
  const bounds = bboxToBounds(metadata.bbox);
  const stats = buildRasterStats({
    fileName,
    width: metadata.width,
    height: metadata.height,
    samplesPerPixel: samples,
    cellSize: metadata.resolution?.[0] ?? null,
    nodata: metadata.nodata,
    bounds,
    crsNote: metadata.crsNote,
    values,
    bandIndex,
    previewWidth: width,
    previewHeight: height,
    sourceKind: 'geotiff',
    stretch,
    colormap,
    displayMode: wantRgb ? 'rgb' : 'colormap'
  });
  const warnings = buildRasterWarnings(
    'geotiff',
    bounds,
    values,
    metadata.width,
    metadata.height,
    metadata.crsNote && /Projected/i.test(metadata.crsNote) ? [metadata.crsNote] : []
  );
  const options: RasterMapRenderOptions = {
    stretch,
    colormap,
    bandIndex,
    opacity: render.opacity ?? 0.9,
    rgbMode: wantRgb,
    red: render.red ?? 0,
    green: render.green ?? 1,
    blue: render.blue ?? 2,
    maxPreviewSide: maxSide
  };
  return {
    metadata,
    stats,
    warnings,
    preview: { dataUrl, width, height },
    valueGrid,
    options
  };
}

export async function openAndParseRaster(
  file: File,
  bytes: Uint8Array,
  render: Partial<RasterMapRenderOptions> = {}
): Promise<{
  sourceKind: RasterMapSourceKind;
  metadata: GeotiffRasterMetadata | null;
  stats: RasterMapDiagramStats;
  warnings: string[];
  preview: { dataUrl: string; width: number; height: number };
  valueGrid: Float64Array;
  options: RasterMapRenderOptions;
  ascText: string | null;
}> {
  const ext = getRasterMapFileExtension(file.name);
  if (ext === '.asc') {
    const text =
      typeof TextDecoder !== 'undefined'
        ? new TextDecoder('utf-8').decode(bytes)
        : Array.from(bytes)
            .map((b) => String.fromCharCode(b))
            .join('');
    const parsed = await openAndParseRasterAsc(text, file.name, render);
    return { sourceKind: 'asc', ascText: text, ...parsed };
  }
  const parsed = await openAndParseRasterGeotiff(bytes, file.name, render);
  return { sourceKind: 'geotiff', ascText: null, ...parsed };
}

export async function reRenderRasterPreview(
  file: RasterMapLoadedFile,
  render: Partial<RasterMapRenderOptions>
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  valueGrid: Float64Array;
  stats: RasterMapDiagramStats;
}> {
  if (file.sourceKind === 'asc') {
    const stretch = render.stretch ?? file.stats.stretch;
    const colormap = render.colormap ?? file.stats.colormap;
    const canvas = buildColormapCanvas(file.valueGrid, file.gridWidth, file.gridHeight, {
      colormap,
      stretch,
      nodata: file.stats.nodata
    });
    const elev = computeElevationStats(file.valueGrid, file.stats.nodata);
    const stats = {
      ...file.stats,
      values: toValueStats(elev),
      stretch,
      colormap,
      displayMode: 'colormap' as const
    };
    return {
      dataUrl: canvasToDataUrl(canvas),
      width: file.gridWidth,
      height: file.gridHeight,
      valueGrid: file.valueGrid,
      stats
    };
  }

  const result = await openAndParseRasterGeotiff(file.bytes, file.name, {
    ...render,
    maxPreviewSide: render.maxPreviewSide ?? RASTER_MAP_MAX_PREVIEW_SIDE
  });
  return {
    dataUrl: result.preview.dataUrl,
    width: result.preview.width,
    height: result.preview.height,
    valueGrid: result.valueGrid,
    stats: result.stats
  };
}

export function metadataRows(file: RasterMapLoadedFile): RasterMapMetadataRow[] {
  const rows: RasterMapMetadataRow[] = [
    { key: 'source', value: file.sourceKind },
    { key: 'width', value: String(file.stats.width) },
    { key: 'height', value: String(file.stats.height) },
    { key: 'bands', value: String(file.stats.samplesPerPixel) },
    {
      key: 'cellSize',
      value: file.stats.cellSize == null ? '—' : String(file.stats.cellSize)
    },
    {
      key: 'nodata',
      value: file.stats.nodata == null ? '—' : String(file.stats.nodata)
    },
    {
      key: 'valueMin',
      value: file.stats.values.validCount ? file.stats.values.min.toFixed(4) : '—'
    },
    {
      key: 'valueMax',
      value: file.stats.values.validCount ? file.stats.values.max.toFixed(4) : '—'
    },
    { key: 'crs', value: file.stats.crsNote || '—' }
  ];
  if (file.stats.bounds) {
    const b = file.stats.bounds;
    rows.push({
      key: 'bounds',
      value: `${b.west.toFixed(4)}, ${b.south.toFixed(4)} → ${b.east.toFixed(4)}, ${b.north.toFixed(4)}`
    });
  }
  if (file.metadata) {
    rows.push({ key: 'photometric', value: file.metadata.photometricLabel });
    rows.push({ key: 'compression', value: file.metadata.compressionLabel });
    rows.push({
      key: 'bitsPerSample',
      value: bitsPerSampleLabel(file.metadata.bitsPerSample)
    });
  }
  return rows;
}

export function formatBounds(bounds: GeotiffBounds | null): string {
  if (!bounds) return '—';
  const fmt = (n: number) => n.toFixed(4);
  return `${fmt(bounds.west)}, ${fmt(bounds.south)} → ${fmt(bounds.east)}, ${fmt(bounds.north)}`;
}

export function exportMetadataJson(file: RasterMapLoadedFile): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      sourceKind: file.sourceKind,
      metadata: file.metadata,
      stats: file.stats
    },
    null,
    2
  );
}

export function exportSummaryJson(file: RasterMapLoadedFile): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      stats: file.stats,
      values: file.stats.values,
      legend: {
        colormap: file.stats.colormap,
        stretch: file.stats.stretch,
        min: file.stats.values.min,
        max: file.stats.values.max,
        note: 'Legend bar maps min→max with the selected colormap (single-band mode).'
      },
      warnings: file.warnings
    },
    null,
    2
  );
}

export function canExportRasterMap(file: RasterMapLoadedFile | null): boolean {
  return !!file?.bytes?.length;
}

export function bandOptions(samplesPerPixel: number): number[] {
  const n = Math.max(1, samplesPerPixel);
  return Array.from({ length: n }, (_, i) => i);
}

export function resolveRasterMapSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  hasBounds: boolean;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'raster-map-error',
      title: 'Try the sample grid',
      reason: 'Upload a GeoTIFF or ASCII Grid (.asc), or load the embedded sample.',
      actionLabel: 'GeoTIFF Viewer',
      path: '/gis-viewers/geotiff-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'raster-map-intro',
      title: 'Open a generic raster',
      reason: 'Stretch bands, pick a colormap legend, or view RGB composites.',
      actionLabel: 'Related: DEM',
      path: '/gis-viewers/dem-viewer'
    };
  }
  if (!state.hasBounds) {
    return {
      id: 'raster-map-bounds',
      title: 'Missing georeferencing',
      reason: 'Overlay uses a default world view. Prefer GeoTIFF with geokeys or ASC corners.',
      actionLabel: 'GeoTIFF Viewer',
      path: '/gis-viewers/geotiff-viewer'
    };
  }
  return null;
}

export function fitMapToRaster(
  map: LeafletMap,
  L: LeafletModule,
  stats: RasterMapDiagramStats
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

export function rasterImageBounds(
  L: LeafletModule,
  stats: RasterMapDiagramStats
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
  stats: RasterMapDiagramStats,
  opacity: number,
  existing: ImageOverlay | null
): ImageOverlay {
  const bounds = rasterImageBounds(L, stats);
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

export { canvasToDataUrl };
