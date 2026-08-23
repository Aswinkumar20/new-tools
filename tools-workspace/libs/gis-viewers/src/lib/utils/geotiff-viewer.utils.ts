import type { Map as LeafletMap, ImageOverlay, LatLngBoundsExpression } from 'leaflet';
import {
  GEOTIFF_MAX_FILE_BYTES,
  GEOTIFF_MAX_PREVIEW_SIDE,
  GEOTIFF_SAMPLE_BASE64,
  GEOTIFF_SUPPORTED_EXTENSIONS
} from '../constants/geotiff-viewer.constants';
import type {
  GeotiffBandSelection,
  GeotiffBounds,
  GeotiffDiagramStats,
  GeotiffLoadedFile,
  GeotiffMetadataRow,
  GeotiffRasterMetadata,
  GeotiffStretchMode
} from '../types/geotiff-viewer.types';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';
import {
  analyzeCogCompliance,
  buildGeotiffStats,
  buildGeotiffWarnings,
  defaultBandSelection,
  downloadBinaryFile,
  downloadCanvasPng,
  extractRasterMetadata,
  fromArrayBuffer,
  renderPreviewDataUrl,
  uint8ToArrayBuffer
} from './geotiff-raster.utils';

export {
  configureLeafletDefaultIcons,
  downloadBinaryFile,
  downloadCanvasPng,
  downloadTextFile,
  loadLeaflet,
  analyzeCogCompliance,
  defaultBandSelection,
  fromArrayBuffer
};

type LeafletModule = typeof import('leaflet');

export function ensureGeotiffStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'geotiffCss');
}

export function getGeotiffFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function isSupportedGeotiffFile(file: File): boolean {
  const ext = getGeotiffFileExtension(file.name);
  if (GEOTIFF_SUPPORTED_EXTENSIONS.includes(ext)) {
    return true;
  }
  const type = (file.type || '').toLowerCase();
  return type.includes('tiff') || type.includes('geotiff') || type === 'application/octet-stream';
}

export function formatGeotiffFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateGeotiffFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > GEOTIFF_MAX_FILE_BYTES) {
    return `File is too large (max ${formatGeotiffFileSize(GEOTIFF_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidGeotiffFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const file of Array.from(files)) {
    const ext = getGeotiffFileExtension(file.name);
    if (!GEOTIFF_SUPPORTED_EXTENSIONS.includes(ext)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .tif, .tiff, or .geotiff)'
      });
      continue;
    }
    const sizeError = validateGeotiffFileSize(file);
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

/** Builds a sample .tif File from the embedded base64 (lastModified: 0). */
export function createSampleGeotiffFile(): File {
  const bytes = base64ToUint8Array(GEOTIFF_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-city.tif', {
    type: 'image/tiff',
    lastModified: 0
  });
}

export async function readGeotiffFileBytes(file: File): Promise<Uint8Array> {
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
      reject(new Error('Failed to read GeoTIFF file'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read GeoTIFF file'));
    reader.readAsArrayBuffer(file);
  });
}

export function createGeotiffFileRecord(
  file: File,
  bytes: Uint8Array,
  metadata: GeotiffRasterMetadata,
  stats: GeotiffDiagramStats,
  warnings: string[],
  preview: { dataUrl: string; width: number; height: number }
): GeotiffLoadedFile {
  return {
    id: `${file.name}|${file.size}|${file.lastModified}`,
    name: file.name,
    size: file.size,
    bytes,
    metadata,
    stats,
    warnings,
    cog: null,
    previewDataUrl: preview.dataUrl,
    previewWidth: preview.width,
    previewHeight: preview.height
  };
}

export async function openAndParseGeotiff(
  bytes: Uint8Array,
  fileName: string,
  render: {
    bands?: GeotiffBandSelection;
    stretch?: GeotiffStretchMode;
  } = {}
): Promise<{
  metadata: GeotiffRasterMetadata;
  stats: GeotiffDiagramStats;
  warnings: string[];
  preview: { dataUrl: string; width: number; height: number };
  bands: GeotiffBandSelection;
}> {
  const tiff = await fromArrayBuffer(uint8ToArrayBuffer(bytes));
  const metadata = await extractRasterMetadata(tiff, 0);
  const bands = render.bands ?? defaultBandSelection(metadata.samplesPerPixel);
  const stretch = render.stretch ?? 'minmax';
  const preview = await renderPreviewDataUrl(tiff, metadata, bands, stretch, {
    maxPreviewSide: GEOTIFF_MAX_PREVIEW_SIDE
  });
  const stats = buildGeotiffStats(metadata, fileName);
  const warnings = buildGeotiffWarnings(metadata);
  return { metadata, stats, warnings, preview, bands };
}

export async function reRenderGeotiffPreview(
  bytes: Uint8Array,
  metadata: GeotiffRasterMetadata,
  bands: GeotiffBandSelection,
  stretch: GeotiffStretchMode
): Promise<{ dataUrl: string; width: number; height: number }> {
  const tiff = await fromArrayBuffer(uint8ToArrayBuffer(bytes));
  const preview = await renderPreviewDataUrl(tiff, metadata, bands, stretch, {
    maxPreviewSide: GEOTIFF_MAX_PREVIEW_SIDE
  });
  return { dataUrl: preview.dataUrl, width: preview.width, height: preview.height };
}

export function metadataRows(metadata: GeotiffRasterMetadata): GeotiffMetadataRow[] {
  const rows: GeotiffMetadataRow[] = [
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
    { key: 'tiled', value: metadata.tiled ? 'yes' : 'no' },
    {
      key: 'tileSize',
      value:
        metadata.tileWidth != null
          ? `${metadata.tileWidth}×${metadata.tileHeight}`
          : '—'
    },
    { key: 'imageCount', value: String(metadata.imageCount) },
    {
      key: 'origin',
      value: metadata.origin
        ? metadata.origin.map((n) => n.toFixed(6)).join(', ')
        : '—'
    },
    {
      key: 'resolution',
      value: metadata.resolution
        ? metadata.resolution.map((n) => String(n)).join(', ')
        : '—'
    },
    {
      key: 'bbox',
      value: metadata.bbox
        ? metadata.bbox.map((n) => n.toFixed(6)).join(', ')
        : '—'
    },
    { key: 'nodata', value: metadata.nodata == null ? '—' : String(metadata.nodata) },
    { key: 'crs', value: metadata.crsNote || '—' }
  ];
  for (const key of Object.keys(metadata.geoKeys).sort()) {
    rows.push({ key: `geoKey.${key}`, value: String(metadata.geoKeys[key]) });
  }
  for (const key of Object.keys(metadata.gdalMetadata).sort()) {
    rows.push({ key: `gdal.${key}`, value: metadata.gdalMetadata[key] });
  }
  return rows;
}

export function formatBounds(bounds: GeotiffBounds | null): string {
  if (!bounds) {
    return '—';
  }
  const fmt = (n: number) => n.toFixed(4);
  return `${fmt(bounds.west)}, ${fmt(bounds.south)} → ${fmt(bounds.east)}, ${fmt(bounds.north)}`;
}

export function exportMetadataJson(file: GeotiffLoadedFile): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      metadata: file.metadata
    },
    null,
    2
  );
}

export function exportSummaryJson(file: GeotiffLoadedFile): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      stats: file.stats,
      warnings: file.warnings
    },
    null,
    2
  );
}

export function canExportGeotiff(file: GeotiffLoadedFile | null): boolean {
  return !!file?.bytes?.length;
}

export function fitMapToGeotiff(
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

export function geotiffImageBounds(
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
  const bounds = geotiffImageBounds(L, stats);
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

export function resolveGeotiffSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  hasBounds: boolean;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'geotiff-error',
      title: 'Need a valid GeoTIFF?',
      reason: 'Upload a georeferenced .tif / .tiff raster, or try the COG viewer for cloud-optimized files.',
      actionLabel: 'Open COG Viewer',
      path: '/gis-viewers/cog-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'geotiff-intro',
      title: 'Start with a GeoTIFF raster',
      reason: 'Drop a .tif file or load the sample San Francisco tile to preview bands on a map.',
      actionLabel: 'Related: MBTiles',
      path: '/gis-viewers/mbtiles-viewer'
    };
  }
  if (!state.hasBounds) {
    return {
      id: 'geotiff-nogeoref',
      title: 'Missing georeferencing',
      reason: 'This raster has no bbox. Add ModelTiepoint tags or open a COG with known CRS.',
      actionLabel: 'Open COG Viewer',
      path: '/gis-viewers/cog-viewer'
    };
  }
  return null;
}

export function bandOptions(samplesPerPixel: number): number[] {
  return Array.from({ length: Math.max(1, samplesPerPixel) }, (_, i) => i);
}
