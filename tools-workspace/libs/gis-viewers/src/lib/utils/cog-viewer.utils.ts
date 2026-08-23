import {
  COG_MAX_FILE_BYTES,
  COG_MAX_PREVIEW_SIDE,
  COG_SAMPLE_BASE64,
  COG_SUPPORTED_EXTENSIONS
} from '../constants/cog-viewer.constants';
import type {
  CogBandSelection,
  CogLoadedFile,
  CogMetadataRow,
  CogRasterMetadata,
  CogStretchMode,
  CogWindowOptions
} from '../types/cog-viewer.types';
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
  centerWindow,
  defaultBandSelection,
  downloadBinaryFile,
  downloadCanvasPng,
  extractRasterMetadata,
  fromArrayBuffer,
  fromUrl,
  renderPreviewDataUrl,
  uint8ToArrayBuffer
} from './geotiff-raster.utils';
import {
  createOrUpdateImageOverlay,
  fitMapToGeotiff,
  formatBounds,
  geotiffImageBounds
} from './geotiff-viewer.utils';

export {
  configureLeafletDefaultIcons,
  downloadBinaryFile,
  downloadCanvasPng,
  downloadTextFile,
  loadLeaflet,
  analyzeCogCompliance,
  defaultBandSelection,
  fromArrayBuffer,
  fromUrl,
  createOrUpdateImageOverlay,
  fitMapToGeotiff,
  formatBounds,
  geotiffImageBounds,
  centerWindow
};

export function ensureCogStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'cogCss');
}

export function getCogFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function isSupportedCogFile(file: File): boolean {
  const ext = getCogFileExtension(file.name);
  if (COG_SUPPORTED_EXTENSIONS.includes(ext)) {
    return true;
  }
  const type = (file.type || '').toLowerCase();
  return type.includes('tiff') || type.includes('geotiff') || type === 'application/octet-stream';
}

export function formatCogFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateCogFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > COG_MAX_FILE_BYTES) {
    return `File is too large (max ${formatCogFileSize(COG_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidCogFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const file of Array.from(files)) {
    const ext = getCogFileExtension(file.name);
    if (!COG_SUPPORTED_EXTENSIONS.includes(ext)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .tif, .tiff, or .geotiff)'
      });
      continue;
    }
    const sizeError = validateCogFileSize(file);
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

/** Builds a sample COG-named .tif File from the embedded base64 (lastModified: 0). */
export function createSampleCogFile(): File {
  const bytes = base64ToUint8Array(COG_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-city-cog.tif', {
    type: 'image/tiff',
    lastModified: 0
  });
}

export async function readCogFileBytes(file: File): Promise<Uint8Array> {
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
      reject(new Error('Failed to read COG file'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read COG file'));
    reader.readAsArrayBuffer(file);
  });
}

export function createCogFileRecord(
  file: File,
  bytes: Uint8Array,
  metadata: CogRasterMetadata,
  warnings: string[],
  preview: { dataUrl: string; width: number; height: number }
): CogLoadedFile {
  const stats = buildGeotiffStats(metadata, file.name);
  const cog = analyzeCogCompliance(metadata);
  return {
    id: `${file.name}|${file.size}|${file.lastModified}`,
    name: file.name,
    size: file.size,
    bytes,
    metadata,
    stats,
    warnings,
    cog,
    previewDataUrl: preview.dataUrl,
    previewWidth: preview.width,
    previewHeight: preview.height
  };
}

function resolveReadWindow(
  metadata: CogRasterMetadata,
  windowOpts: CogWindowOptions | null | undefined
): [number, number, number, number] | null {
  if (!windowOpts?.enabled) {
    return null;
  }
  return centerWindow(metadata.width, metadata.height, windowOpts.maxWindowSize);
}

export async function openAndParseCog(
  bytes: Uint8Array,
  fileName: string,
  render: {
    bands?: CogBandSelection;
    stretch?: CogStretchMode;
    imageIndex?: number;
    window?: CogWindowOptions | null;
    isSample?: boolean;
  } = {}
): Promise<{
  metadata: CogRasterMetadata;
  warnings: string[];
  preview: { dataUrl: string; width: number; height: number };
  bands: CogBandSelection;
  imageIndex: number;
}> {
  const tiff = await fromArrayBuffer(uint8ToArrayBuffer(bytes));
  const imageIndex = render.imageIndex ?? 0;
  const metadata = await extractRasterMetadata(tiff, imageIndex);
  const bands = render.bands ?? defaultBandSelection(metadata.samplesPerPixel);
  const stretch = render.stretch ?? 'minmax';
  const wnd = resolveReadWindow(metadata, render.window);
  const preview = await renderPreviewDataUrl(tiff, metadata, bands, stretch, {
    imageIndex,
    window: wnd,
    maxPreviewSide: COG_MAX_PREVIEW_SIDE
  });
  const warnings = buildGeotiffWarnings(metadata, {
    treatAsCog: true,
    isSampleCog: !!render.isSample
  });
  return { metadata, warnings, preview, bands, imageIndex };
}

export async function openAndParseCogFromUrl(
  url: string,
  render: {
    bands?: CogBandSelection;
    stretch?: CogStretchMode;
    imageIndex?: number;
    window?: CogWindowOptions | null;
  } = {}
): Promise<{
  metadata: CogRasterMetadata;
  warnings: string[];
  preview: { dataUrl: string; width: number; height: number };
  bands: CogBandSelection;
  imageIndex: number;
  bytes: Uint8Array;
  name: string;
}> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('Enter a URL to a GeoTIFF / COG');
  }
  const tiff = await fromUrl(trimmed);
  const imageIndex = render.imageIndex ?? 0;
  const metadata = await extractRasterMetadata(tiff, imageIndex);
  const bands = render.bands ?? defaultBandSelection(metadata.samplesPerPixel);
  const stretch = render.stretch ?? 'minmax';
  const wnd = resolveReadWindow(metadata, render.window);
  const preview = await renderPreviewDataUrl(tiff, metadata, bands, stretch, {
    imageIndex,
    window: wnd,
    maxPreviewSide: COG_MAX_PREVIEW_SIDE
  });
  const warnings = buildGeotiffWarnings(metadata, { treatAsCog: true });
  warnings.unshift(
    'Remote URL loads require CORS headers on the host. If the request fails, download the file and upload locally.'
  );
  const name = trimmed.split('/').pop()?.split('?')[0] || 'remote-cog.tif';
  return {
    metadata,
    warnings,
    preview,
    bands,
    imageIndex,
    bytes: new Uint8Array(0),
    name
  };
}

export async function reRenderCogPreview(
  bytes: Uint8Array,
  metadata: CogRasterMetadata,
  bands: CogBandSelection,
  stretch: CogStretchMode,
  imageIndex: number,
  windowOpts: CogWindowOptions | null
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!bytes.length) {
    throw new Error('Cannot re-render remote URL preview without local bytes — reload the URL');
  }
  const tiff = await fromArrayBuffer(uint8ToArrayBuffer(bytes));
  const wnd = resolveReadWindow(metadata, windowOpts);
  const preview = await renderPreviewDataUrl(tiff, metadata, bands, stretch, {
    imageIndex,
    window: wnd,
    maxPreviewSide: COG_MAX_PREVIEW_SIDE
  });
  return { dataUrl: preview.dataUrl, width: preview.width, height: preview.height };
}

export function metadataRows(metadata: CogRasterMetadata): CogMetadataRow[] {
  const rows: CogMetadataRow[] = [
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
      key: 'overviews',
      value:
        metadata.overviews.length > 1
          ? metadata.overviews
              .filter((o) => o.index > 0)
              .map((o) => `${o.width}×${o.height}`)
              .join(', ')
          : 'none'
    },
    {
      key: 'origin',
      value: metadata.origin
        ? metadata.origin.map((n) => n.toFixed(6)).join(', ')
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
  return rows;
}

export function exportMetadataJson(file: CogLoadedFile): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      metadata: file.metadata,
      cog: file.cog
    },
    null,
    2
  );
}

export function exportSummaryJson(file: CogLoadedFile): string {
  return JSON.stringify(
    {
      file: { name: file.name, size: file.size },
      stats: file.stats,
      cog: file.cog,
      warnings: file.warnings
    },
    null,
    2
  );
}

export function canExportCog(file: CogLoadedFile | null): boolean {
  return !!file && (!!file.bytes?.length || !!file.previewDataUrl);
}

export function resolveCogSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  softCompliant: boolean | null;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'cog-error',
      title: 'Need a Cloud Optimized GeoTIFF?',
      reason: 'Upload a tiled COG with overviews, or open a plain GeoTIFF in the GeoTIFF Viewer.',
      actionLabel: 'Open GeoTIFF Viewer',
      path: '/gis-viewers/geotiff-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'cog-intro',
      title: 'Inspect a COG locally or by URL',
      reason: 'Drop a Cloud Optimized GeoTIFF, load the sample, or fetch a remote URL (CORS required).',
      actionLabel: 'Related: GeoTIFF',
      path: '/gis-viewers/geotiff-viewer'
    };
  }
  if (state.softCompliant === false) {
    return {
      id: 'cog-soft',
      title: 'Not fully COG-compliant',
      reason: 'This raster is missing tiles and/or overviews. Preview still works — convert with GDAL for production COGs.',
      actionLabel: 'GeoTIFF Viewer',
      path: '/gis-viewers/geotiff-viewer'
    };
  }
  return null;
}

export function bandOptions(samplesPerPixel: number): number[] {
  return Array.from({ length: Math.max(1, samplesPerPixel) }, (_, i) => i);
}
