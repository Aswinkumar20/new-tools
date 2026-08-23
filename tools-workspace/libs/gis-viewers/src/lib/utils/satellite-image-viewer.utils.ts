import type { Map as LeafletMap, ImageOverlay, LatLngBoundsExpression } from 'leaflet';
import {
  SATELLITE_MAX_FILE_BYTES,
  SATELLITE_MAX_PREVIEW_SIDE,
  SATELLITE_SAMPLE_BASE64,
  SATELLITE_SUPPORTED_EXTENSIONS
} from '../constants/satellite-image-viewer.constants';
import type {
  SatelliteBandSelection,
  SatelliteColormap,
  SatelliteCompositePreset,
  SatelliteLoadedFile,
  SatelliteMetadataRow,
  SatelliteStretchMode
} from '../types/satellite-image-viewer.types';
import type {
  GeotiffDiagramStats,
  GeotiffRasterMetadata
} from '../types/geotiff-viewer.types';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';
import {
  buildGeotiffStats,
  buildGeotiffWarnings,
  buildRgbaCanvas,
  canvasToDataUrl,
  defaultBandSelection,
  downloadBinaryFile,
  downloadCanvasPng,
  extractRasterMetadata,
  fromArrayBuffer,
  readPreviewRasters,
  stretchValues,
  uint8ToArrayBuffer
} from './geotiff-raster.utils';

export {
  configureLeafletDefaultIcons,
  downloadBinaryFile,
  downloadCanvasPng,
  downloadTextFile,
  loadLeaflet,
  defaultBandSelection,
  fromArrayBuffer
};

type LeafletModule = typeof import('leaflet');

export function ensureSatelliteStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'satelliteCss');
}

export function getSatelliteFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function isSupportedSatelliteFile(file: File): boolean {
  const ext = getSatelliteFileExtension(file.name);
  return SATELLITE_SUPPORTED_EXTENSIONS.includes(ext);
}

export function formatSatelliteFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateSatelliteFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SATELLITE_MAX_FILE_BYTES) {
    return `File is too large (max ${formatSatelliteFileSize(SATELLITE_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidSatelliteFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const file of Array.from(files)) {
    if (!isSupportedSatelliteFile(file)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .tif, .tiff, or .geotiff)'
      });
      continue;
    }
    const sizeError = validateSatelliteFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.replace(/\s/g, '');
  if (typeof atob === 'function') {
    const binary = atob(cleaned);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  const buf = Buffer.from(cleaned, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export function createSampleSatelliteFile(): File {
  const bytes = base64ToUint8Array(SATELLITE_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-eo.tif', {
    type: 'image/tiff',
    lastModified: 0
  });
}

export async function readSatelliteFileBytes(file: File): Promise<Uint8Array> {
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
      reject(new Error('Failed to read satellite image'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read satellite image'));
    reader.readAsArrayBuffer(file);
  });
}

/** True color prefers bands 1,2,3 (1-based) → indices 0,1,2; falls back to available. */
export function resolveCompositeBands(
  preset: SatelliteCompositePreset,
  samplesPerPixel: number,
  custom: SatelliteBandSelection
): SatelliteBandSelection {
  const n = Math.max(1, samplesPerPixel);
  if (preset === 'custom') {
    return {
      red: clampBand(custom.red, n),
      green: clampBand(custom.green, n),
      blue: clampBand(custom.blue, n),
      grayscale: false
    };
  }
  if (preset === 'grayscale') {
    return {
      red: clampBand(custom.red, n),
      green: 0,
      blue: 0,
      grayscale: true
    };
  }
  if (preset === 'false-color-ir') {
    if (n >= 4) {
      // NIR, Red, Green
      return { red: 3, green: 0, blue: 1, grayscale: false };
    }
    return defaultBandSelection(n);
  }
  if (preset === 'ndvi') {
    // Rendered separately; band selection unused for RGB path
    return { red: 0, green: 0, blue: 0, grayscale: true };
  }
  // true-color: try 1,2,3 (indices 0,1,2) else 0,1,2 clamped
  if (n >= 3) {
    return { red: 0, green: 1, blue: 2, grayscale: false };
  }
  return defaultBandSelection(n);
}

function clampBand(index: number, samples: number): number {
  return Math.min(Math.max(0, Math.floor(index)), samples - 1);
}

export function canUseFalseColorIr(samplesPerPixel: number): boolean {
  return samplesPerPixel >= 4;
}

export function canUseNdvi(samplesPerPixel: number): boolean {
  return samplesPerPixel >= 4;
}

export function buildSatelliteWarnings(
  metadata: GeotiffRasterMetadata,
  preset: SatelliteCompositePreset
): string[] {
  const warnings = buildGeotiffWarnings(metadata);
  if (preset === 'false-color-ir' && !canUseFalseColorIr(metadata.samplesPerPixel)) {
    warnings.push(
      'Fewer than 4 bands — false color IR falls back to true-color / available bands.'
    );
  }
  if (preset === 'ndvi' && !canUseNdvi(metadata.samplesPerPixel)) {
    warnings.push('NDVI needs ≥4 bands (NIR + Red). Soft-disabled for this raster.');
  }
  if (metadata.samplesPerPixel < 3) {
    warnings.push('Few bands for EO composites — true color / IR presets are limited.');
  }
  return warnings;
}

/** Viridis-like and terrain colormaps for NDVI (-1..1 → 0..1). */
export function colormapRgb(
  t: number,
  map: SatelliteColormap
): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  if (map === 'terrain') {
    if (x < 0.25) return lerpRgb([10, 60, 120], [40, 140, 80], x / 0.25);
    if (x < 0.5) return lerpRgb([40, 140, 80], [180, 180, 60], (x - 0.25) / 0.25);
    if (x < 0.75) return lerpRgb([180, 180, 60], [160, 90, 40], (x - 0.5) / 0.25);
    return lerpRgb([160, 90, 40], [230, 230, 230], (x - 0.75) / 0.25);
  }
  // viridis approximation
  if (x < 0.25) return lerpRgb([68, 1, 84], [59, 82, 139], x / 0.25);
  if (x < 0.5) return lerpRgb([59, 82, 139], [33, 145, 140], (x - 0.25) / 0.25);
  if (x < 0.75) return lerpRgb([33, 145, 140], [94, 201, 98], (x - 0.5) / 0.25);
  return lerpRgb([94, 201, 98], [253, 231, 37], (x - 0.75) / 0.25);
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

export function buildNdviCanvas(
  nir: ArrayLike<number>,
  red: ArrayLike<number>,
  width: number,
  height: number,
  options: {
    stretch: SatelliteStretchMode;
    nodata?: number | null;
    colormap?: SatelliteColormap;
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
  const nodata = options.nodata ?? null;
  const map = options.colormap ?? 'viridis';
  const pixelCount = width * height;
  const ndviValues = new Float64Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const n = nir[i];
    const r = red[i];
    if (!Number.isFinite(n) || !Number.isFinite(r) || (nodata != null && (n === nodata || r === nodata))) {
      ndviValues[i] = NaN;
      continue;
    }
    const den = n + r;
    ndviValues[i] = den === 0 ? 0 : (n - r) / den;
  }
  const { min, max } =
    options.stretch === 'none'
      ? { min: -1, max: 1 }
      : stretchValues(ndviValues, options.stretch, null);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const v = ndviValues[i];
    if (!Number.isFinite(v)) {
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 0;
      continue;
    }
    const t = (v - min) / (max - min || 1);
    const [cr, cg, cb] = colormapRgb(t, map);
    data[o] = cr;
    data[o + 1] = cg;
    data[o + 2] = cb;
    data[o + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export async function renderSatellitePreview(
  bytes: Uint8Array,
  metadata: GeotiffRasterMetadata,
  preset: SatelliteCompositePreset,
  bands: SatelliteBandSelection,
  stretch: SatelliteStretchMode,
  colormap: SatelliteColormap = 'viridis'
): Promise<{ dataUrl: string; width: number; height: number }> {
  const tiff = await fromArrayBuffer(uint8ToArrayBuffer(bytes));
  const { bands: rasters, width, height } = await readPreviewRasters(tiff, {
    maxPreviewSide: SATELLITE_MAX_PREVIEW_SIDE
  });

  if (preset === 'ndvi') {
    if (!canUseNdvi(metadata.samplesPerPixel)) {
      const selection = resolveCompositeBands('grayscale', metadata.samplesPerPixel, bands);
      const canvas = buildRgbaCanvas(rasters, width, height, {
        selection,
        stretch,
        nodata: metadata.nodata
      });
      return { dataUrl: canvasToDataUrl(canvas), width, height };
    }
    const nir = rasters[Math.min(3, rasters.length - 1)];
    const red = rasters[0];
    const canvas = buildNdviCanvas(nir, red, width, height, {
      stretch,
      nodata: metadata.nodata,
      colormap
    });
    return { dataUrl: canvasToDataUrl(canvas), width, height };
  }

  const selection = resolveCompositeBands(preset, metadata.samplesPerPixel, bands);
  const canvas = buildRgbaCanvas(rasters, width, height, {
    selection,
    stretch,
    nodata: metadata.nodata
  });
  return { dataUrl: canvasToDataUrl(canvas), width, height };
}

export function createSatelliteFileRecord(
  file: File,
  bytes: Uint8Array,
  metadata: GeotiffRasterMetadata,
  stats: GeotiffDiagramStats,
  warnings: string[],
  preview: { dataUrl: string; width: number; height: number },
  preset: SatelliteCompositePreset
): SatelliteLoadedFile {
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
    preset
  };
}

export async function openAndParseSatellite(
  bytes: Uint8Array,
  fileName: string,
  options: {
    preset?: SatelliteCompositePreset;
    bands?: SatelliteBandSelection;
    stretch?: SatelliteStretchMode;
    colormap?: SatelliteColormap;
  } = {}
): Promise<{
  metadata: GeotiffRasterMetadata;
  stats: GeotiffDiagramStats;
  warnings: string[];
  preview: { dataUrl: string; width: number; height: number };
  bands: SatelliteBandSelection;
  preset: SatelliteCompositePreset;
}> {
  const tiff = await fromArrayBuffer(uint8ToArrayBuffer(bytes));
  const metadata = await extractRasterMetadata(tiff, 0);
  const preset = options.preset ?? 'true-color';
  const stretch = options.stretch ?? 'minmax';
  const bands =
    options.bands ??
    resolveCompositeBands(preset, metadata.samplesPerPixel, defaultBandSelection(metadata.samplesPerPixel));
  const preview = await renderSatellitePreview(
    bytes,
    metadata,
    preset,
    bands,
    stretch,
    options.colormap ?? 'viridis'
  );
  const stats = buildGeotiffStats(metadata, fileName);
  const warnings = buildSatelliteWarnings(metadata, preset);
  return { metadata, stats, warnings, preview, bands, preset };
}

export function metadataRows(metadata: GeotiffRasterMetadata): SatelliteMetadataRow[] {
  const rows: SatelliteMetadataRow[] = [
    { key: 'width', value: String(metadata.width) },
    { key: 'height', value: String(metadata.height) },
    { key: 'samplesPerPixel', value: String(metadata.samplesPerPixel) },
    { key: 'photometric', value: metadata.photometricLabel },
    { key: 'compression', value: metadata.compressionLabel },
    {
      key: 'bbox',
      value: metadata.bbox ? metadata.bbox.map((n) => n.toFixed(6)).join(', ') : '—'
    },
    { key: 'crs', value: metadata.crsNote || '—' }
  ];
  return rows;
}

export function formatBounds(
  bounds: { west: number; south: number; east: number; north: number } | null
): string {
  if (!bounds) return '—';
  const fmt = (n: number) => n.toFixed(4);
  return `${fmt(bounds.west)}, ${fmt(bounds.south)} → ${fmt(bounds.east)}, ${fmt(bounds.north)}`;
}

export function exportMetadataJson(file: SatelliteLoadedFile): string {
  return JSON.stringify(
    { file: { name: file.name, size: file.size }, metadata: file.metadata },
    null,
    2
  );
}

export function exportSummaryJson(file: SatelliteLoadedFile): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      stats: file.stats,
      preset: file.preset,
      warnings: file.warnings
    },
    null,
    2
  );
}

export function canExportSatellite(file: SatelliteLoadedFile | null): boolean {
  return !!file?.bytes?.length;
}

export function fitMapToSatellite(
  map: LeafletMap,
  L: LeafletModule,
  stats: GeotiffDiagramStats
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

export function satelliteImageBounds(
  L: LeafletModule,
  stats: GeotiffDiagramStats
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
  stats: GeotiffDiagramStats,
  opacity: number,
  existing: ImageOverlay | null
): ImageOverlay {
  const bounds = satelliteImageBounds(L, stats);
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

export function resolveSatelliteSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  hasBounds: boolean;
  bandCount: number;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'satellite-error',
      title: 'Need an EO GeoTIFF?',
      reason: 'Upload a multi-band .tif / .tiff for true color, false color IR, or NDVI.',
      actionLabel: 'Open GeoTIFF Viewer',
      path: '/gis-viewers/geotiff-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'satellite-intro',
      title: 'Start with satellite imagery',
      reason:
        'Drop a GeoTIFF or load the sample EO tile. Try true color, false color IR, or NDVI when bands allow.',
      actionLabel: 'Related: COG Viewer',
      path: '/gis-viewers/cog-viewer'
    };
  }
  if (!state.hasBounds) {
    return {
      id: 'satellite-nogeoref',
      title: 'Missing georeferencing',
      reason: 'This raster has no bbox — map overlay may be approximate.',
      actionLabel: 'Open COG Viewer',
      path: '/gis-viewers/cog-viewer'
    };
  }
  if (state.bandCount < 4) {
    return {
      id: 'satellite-bands',
      title: 'Limited EO composites',
      reason: 'Fewer than 4 bands — false color IR and NDVI are soft-limited. True color still works when ≥3.',
      actionLabel: 'GeoTIFF Viewer',
      path: '/gis-viewers/geotiff-viewer'
    };
  }
  return null;
}

export function bandOptions(samplesPerPixel: number): number[] {
  return Array.from({ length: Math.max(1, samplesPerPixel) }, (_, i) => i);
}
