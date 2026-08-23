import { fromArrayBuffer as geotiffFromArrayBuffer, fromUrl as geotiffFromUrl } from 'geotiff';
import type { GeoTIFF, GeoTIFFImage } from 'geotiff';
import type {
  CogComplianceFlags,
  GeotiffBandSelection,
  GeotiffBounds,
  GeotiffDiagramStats,
  GeotiffRasterMetadata,
  GeotiffStretchMode,
  GeotiffOverviewInfo
} from '../types/geotiff-viewer.types';
import { downloadBinaryFile } from './sqljs-db.utils';
import { downloadTextFile } from './leaflet-map.utils';

export { downloadBinaryFile, downloadTextFile };

export const DEFAULT_MAX_PREVIEW_SIDE = 1024;

const COMPRESSION_LABELS: Record<number, string> = {
  1: 'Uncompressed',
  5: 'LZW',
  6: 'JPEG (old)',
  7: 'JPEG',
  8: 'Deflate (Adobe)',
  32773: 'PackBits',
  32946: 'Deflate',
  50000: 'ZSTD'
};

const PHOTOMETRIC_LABELS: Record<number, string> = {
  0: 'WhiteIsZero',
  1: 'BlackIsZero',
  2: 'RGB',
  3: 'Palette',
  4: 'TransparencyMask',
  5: 'CMYK',
  6: 'YCbCr',
  8: 'CIELab'
};

export async function fromArrayBuffer(buffer: ArrayBuffer): Promise<GeoTIFF> {
  return geotiffFromArrayBuffer(buffer);
}

export async function fromUrl(url: string): Promise<GeoTIFF> {
  return geotiffFromUrl(url);
}

export function computePreviewSize(
  width: number,
  height: number,
  maxSide = DEFAULT_MAX_PREVIEW_SIDE
): { width: number; height: number; downsampled: boolean } {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const longest = Math.max(w, h);
  if (longest <= maxSide) {
    return { width: w, height: h, downsampled: false };
  }
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    downsampled: true
  };
}

export function stretchValues(
  values: ArrayLike<number>,
  mode: GeotiffStretchMode,
  nodata: number | null = null
): { min: number; max: number } {
  const samples: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) {
      continue;
    }
    if (nodata != null && v === nodata) {
      continue;
    }
    samples.push(v);
  }
  if (samples.length === 0) {
    return { min: 0, max: 1 };
  }
  if (mode === 'none') {
    return { min: 0, max: 255 };
  }
  if (mode === 'minmax') {
    let min = samples[0];
    let max = samples[0];
    for (const v of samples) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min === max) {
      return { min, max: min + 1 };
    }
    return { min, max };
  }
  // percentile 2–98
  samples.sort((a, b) => a - b);
  const lo = percentileSorted(samples, 2);
  const hi = percentileSorted(samples, 98);
  if (lo === hi) {
    return { min: lo, max: lo + 1 };
  }
  return { min: lo, max: hi };
}

function percentileSorted(sorted: number[], pct: number): number {
  if (sorted.length === 1) {
    return sorted[0];
  }
  const rank = (pct / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) {
    return sorted[lo];
  }
  const t = rank - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

export function scaleToByte(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const t = (value - min) / (max - min);
  return Math.max(0, Math.min(255, Math.round(t * 255)));
}

function asTypedBands(rasters: unknown): ArrayLike<number>[] {
  if (Array.isArray(rasters)) {
    return rasters as ArrayLike<number>[];
  }
  // Interleaved single array — treat as one band for grayscale fallback.
  return [rasters as ArrayLike<number>];
}

export function buildRgbaCanvas(
  bands: ArrayLike<number>[],
  width: number,
  height: number,
  options: {
    selection: GeotiffBandSelection;
    stretch: GeotiffStretchMode;
    nodata?: number | null;
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
  const pixelCount = width * height;

  if (options.selection.grayscale || bands.length === 1) {
    const bandIndex = Math.min(Math.max(0, options.selection.red), bands.length - 1);
    const band = bands[bandIndex];
    const { min, max } = stretchValues(band, options.stretch, nodata);
    for (let i = 0; i < pixelCount; i++) {
      const v = band[i];
      const o = i * 4;
      if (nodata != null && v === nodata) {
        data[o] = 0;
        data[o + 1] = 0;
        data[o + 2] = 0;
        data[o + 3] = 0;
        continue;
      }
      const b =
        options.stretch === 'none' && Number.isFinite(v)
          ? Math.max(0, Math.min(255, Math.round(v)))
          : scaleToByte(v, min, max);
      data[o] = b;
      data[o + 1] = b;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  } else {
    const rIdx = Math.min(Math.max(0, options.selection.red), bands.length - 1);
    const gIdx = Math.min(Math.max(0, options.selection.green), bands.length - 1);
    const bIdx = Math.min(Math.max(0, options.selection.blue), bands.length - 1);
    const rBand = bands[rIdx];
    const gBand = bands[gIdx];
    const bBand = bands[bIdx];
    const rRange = stretchValues(rBand, options.stretch, nodata);
    const gRange = stretchValues(gBand, options.stretch, nodata);
    const bRange = stretchValues(bBand, options.stretch, nodata);
    for (let i = 0; i < pixelCount; i++) {
      const rv = rBand[i];
      const gv = gBand[i];
      const bv = bBand[i];
      const o = i * 4;
      if (
        nodata != null &&
        (rv === nodata || gv === nodata || bv === nodata)
      ) {
        data[o] = 0;
        data[o + 1] = 0;
        data[o + 2] = 0;
        data[o + 3] = 0;
        continue;
      }
      data[o] =
        options.stretch === 'none'
          ? Math.max(0, Math.min(255, Math.round(rv)))
          : scaleToByte(rv, rRange.min, rRange.max);
      data[o + 1] =
        options.stretch === 'none'
          ? Math.max(0, Math.min(255, Math.round(gv)))
          : scaleToByte(gv, gRange.min, gRange.max);
      data[o + 2] =
        options.stretch === 'none'
          ? Math.max(0, Math.min(255, Math.round(bv)))
          : scaleToByte(bv, bRange.min, bRange.max);
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode PNG'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, fileName: string): void {
  if (typeof document === 'undefined') {
    throw new Error('Download is only available in the browser');
  }
  const dataUrl = canvasToDataUrl(canvas);
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = fileName.trim() || 'preview.png';
  anchor.click();
}

export async function downloadPngBlob(blob: Blob, fileName: string): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('Download is only available in the browser');
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.trim() || 'preview.png';
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeOrigin(image: GeoTIFFImage): [number, number, number] | null {
  try {
    const o = image.getOrigin();
    return [o[0], o[1], o[2] ?? 0];
  } catch {
    return null;
  }
}

function safeResolution(image: GeoTIFFImage): [number, number, number] | null {
  try {
    const r = image.getResolution();
    return [r[0], r[1], r[2] ?? 0];
  } catch {
    return null;
  }
}

function safeBbox(image: GeoTIFFImage): [number, number, number, number] | null {
  try {
    const b = image.getBoundingBox();
    return [b[0], b[1], b[2], b[3]];
  } catch {
    return null;
  }
}

function crsNoteFromGeoKeys(geoKeys: Record<string, number | string>): string | null {
  const modelType = Number(geoKeys['GTModelTypeGeoKey']);
  const geographic = Number(geoKeys['GeographicTypeGeoKey']);
  const projected = Number(geoKeys['ProjectedCSTypeGeoKey']);
  if (modelType === 2 || geographic === 4326) {
    return geographic === 4326 ? 'Geographic CRS (EPSG:4326 WGS84)' : 'Geographic CRS';
  }
  if (modelType === 1 || Number.isFinite(projected)) {
    return projected
      ? `Projected CRS (EPSG:${projected}) — map overlay assumes WGS84-like bounds`
      : 'Projected CRS — map overlay may be approximate';
  }
  if (Object.keys(geoKeys).length === 0) {
    return null;
  }
  return 'CRS from GeoKeys — verify map alignment';
}

export function bitsPerSampleLabel(bits: number | number[]): string {
  if (Array.isArray(bits)) {
    return bits.join('/');
  }
  return String(bits);
}

export async function extractRasterMetadata(
  tiff: GeoTIFF,
  imageIndex = 0
): Promise<GeotiffRasterMetadata> {
  const imageCount = await tiff.getImageCount();
  const image = await tiff.getImage(imageIndex);
  const overviews: GeotiffOverviewInfo[] = [];
  for (let i = 0; i < imageCount; i++) {
    const img = await tiff.getImage(i);
    overviews.push({
      index: i,
      width: img.getWidth(),
      height: img.getHeight()
    });
  }

  const fd = image.getFileDirectory() || {};
  const geoKeysRaw = image.getGeoKeys() || {};
  const geoKeys: Record<string, number | string> = {};
  for (const key of Object.keys(geoKeysRaw)) {
    const value = geoKeysRaw[key];
    if (typeof value === 'number' || typeof value === 'string') {
      geoKeys[key] = value;
    } else if (value != null) {
      geoKeys[key] = String(value);
    }
  }

  const compression = typeof fd.Compression === 'number' ? fd.Compression : null;
  const photometric =
    typeof fd.PhotometricInterpretation === 'number' ? fd.PhotometricInterpretation : null;
  const bits = image.getBitsPerSample(0);
  const bitsArray = Array.isArray(fd.BitsPerSample)
    ? (fd.BitsPerSample as number[])
    : bits;

  let gdalMetadata: Record<string, string> = {};
  try {
    const meta = image.getGDALMetadata() || {};
    gdalMetadata = Object.fromEntries(
      Object.entries(meta).map(([k, v]) => [k, v == null ? '' : String(v)])
    );
  } catch {
    gdalMetadata = {};
  }

  const tiled = !!image.isTiled;
  const crsNote = crsNoteFromGeoKeys(geoKeys);

  return {
    width: image.getWidth(),
    height: image.getHeight(),
    samplesPerPixel: image.getSamplesPerPixel(),
    bitsPerSample: bitsArray,
    photometric,
    photometricLabel:
      photometric != null
        ? PHOTOMETRIC_LABELS[photometric] || `Code ${photometric}`
        : '—',
    geoKeys,
    origin: safeOrigin(image),
    resolution: safeResolution(image),
    bbox: safeBbox(image),
    nodata: image.getGDALNoData(),
    tiled,
    tileWidth: tiled ? image.getTileWidth() : null,
    tileHeight: tiled ? image.getTileHeight() : null,
    compression,
    compressionLabel:
      compression != null
        ? COMPRESSION_LABELS[compression] || `Code ${compression}`
        : '—',
    imageCount,
    overviews,
    gdalMetadata,
    crsNote
  };
}

export function analyzeCogCompliance(metadata: GeotiffRasterMetadata): CogComplianceFlags {
  const isTiled = metadata.tiled;
  const hasOverviews = metadata.imageCount > 1;
  const overviewSizes = metadata.overviews
    .filter((o) => o.index > 0)
    .map((o) => ({ width: o.width, height: o.height }));

  const checklist: CogComplianceFlags['checklist'] = [
    {
      id: 'tiled',
      label: 'Tiled IFD',
      status: isTiled ? 'ok' : 'fail',
      detail: isTiled
        ? `Tiles ${metadata.tileWidth}×${metadata.tileHeight}`
        : 'Strip layout detected — COGs should use tiles'
    },
    {
      id: 'overviews',
      label: 'Overviews / reduced-resolution IFDs',
      status: hasOverviews ? 'ok' : 'warn',
      detail: hasOverviews
        ? `${metadata.imageCount - 1} overview level(s)`
        : 'No overviews — large remote reads will be slower'
    },
    {
      id: 'georef',
      label: 'Georeferencing',
      status: metadata.bbox ? 'ok' : 'warn',
      detail: metadata.bbox
        ? `BBox ${metadata.bbox.map((n) => n.toFixed(4)).join(', ')}`
        : 'Missing ModelTiepoint / ModelPixelScale / transform'
    },
    {
      id: 'compression',
      label: 'Compression',
      status:
        metadata.compression && metadata.compression !== 1 ? 'ok' : 'warn',
      detail: metadata.compressionLabel
    }
  ];

  const warnings: string[] = [];
  if (!isTiled) {
    warnings.push(
      'Not tiled (strip layout). This file is not fully Cloud Optimized GeoTIFF compliant.'
    );
  }
  if (!hasOverviews) {
    warnings.push('No internal overviews — not fully COG-compliant for efficient zoom levels.');
  }
  const softCompliant = isTiled && hasOverviews;

  return {
    isTiled,
    hasOverviews,
    imageCount: metadata.imageCount,
    overviewSizes,
    softCompliant,
    warnings,
    checklist
  };
}

export function bboxToBounds(
  bbox: [number, number, number, number] | null
): GeotiffBounds | null {
  if (!bbox || bbox.length < 4) {
    return null;
  }
  const [west, south, east, north] = bbox;
  if (![west, south, east, north].every((n) => Number.isFinite(n))) {
    return null;
  }
  return { west, south, east, north };
}

export function buildGeotiffStats(
  metadata: GeotiffRasterMetadata,
  fileName: string
): GeotiffDiagramStats {
  return {
    title: fileName.replace(/\.(tif|tiff|geotiff)$/i, '') || 'GeoTIFF',
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
    crsNote: metadata.crsNote
  };
}

export function buildGeotiffWarnings(
  metadata: GeotiffRasterMetadata,
  options: { treatAsCog?: boolean; isSampleCog?: boolean } = {}
): string[] {
  const warnings: string[] = [];
  if (!metadata.bbox) {
    warnings.push('No georeferencing found — overlay will use a default world view.');
  }
  if (metadata.crsNote && /Projected/i.test(metadata.crsNote)) {
    warnings.push(metadata.crsNote);
  }
  if (Math.max(metadata.width, metadata.height) > 8192) {
    warnings.push(
      `Large raster (${metadata.width}×${metadata.height}). Preview is downsampled for performance.`
    );
  }
  if (options.treatAsCog || options.isSampleCog) {
    const cog = analyzeCogCompliance(metadata);
    for (const w of cog.warnings) {
      if (!warnings.includes(w)) {
        warnings.push(w);
      }
    }
    if (options.isSampleCog) {
      warnings.push(
        'Sample uses strip layout / missing overviews — useful for preview, not a full COG.'
      );
    }
  }
  return warnings;
}

export function defaultBandSelection(samplesPerPixel: number): GeotiffBandSelection {
  if (samplesPerPixel <= 1) {
    return { red: 0, green: 0, blue: 0, grayscale: true };
  }
  return {
    red: 0,
    green: Math.min(1, samplesPerPixel - 1),
    blue: Math.min(2, samplesPerPixel - 1),
    grayscale: false
  };
}

export function centerWindow(
  width: number,
  height: number,
  maxWindowSize: number
): [number, number, number, number] {
  const side = Math.max(1, Math.min(maxWindowSize, width, height));
  const minX = Math.max(0, Math.floor((width - side) / 2));
  const minY = Math.max(0, Math.floor((height - side) / 2));
  const maxX = Math.min(width, minX + side);
  const maxY = Math.min(height, minY + side);
  return [minX, minY, maxX, maxY];
}

export async function readPreviewRasters(
  tiff: GeoTIFF,
  options: {
    imageIndex?: number;
    window?: [number, number, number, number] | null;
    maxPreviewSide?: number;
    samples?: number[];
  } = {}
): Promise<{
  bands: ArrayLike<number>[];
  width: number;
  height: number;
  image: GeoTIFFImage;
  downsampled: boolean;
}> {
  const imageIndex = options.imageIndex ?? 0;
  const image = await tiff.getImage(imageIndex);
  const fullWidth = image.getWidth();
  const fullHeight = image.getHeight();
  const wnd = options.window ?? null;
  const srcWidth = wnd ? Math.max(1, wnd[2] - wnd[0]) : fullWidth;
  const srcHeight = wnd ? Math.max(1, wnd[3] - wnd[1]) : fullHeight;
  const preview = computePreviewSize(
    srcWidth,
    srcHeight,
    options.maxPreviewSide ?? DEFAULT_MAX_PREVIEW_SIDE
  );

  const readOptions: {
    width: number;
    height: number;
    interleave: false;
    window?: number[];
    samples?: number[];
  } = {
    width: preview.width,
    height: preview.height,
    interleave: false
  };
  if (wnd) {
    readOptions.window = [wnd[0], wnd[1], wnd[2], wnd[3]];
  }
  if (options.samples?.length) {
    readOptions.samples = options.samples;
  }

  const rasters = await image.readRasters(readOptions);
  return {
    bands: asTypedBands(rasters),
    width: preview.width,
    height: preview.height,
    image,
    downsampled: preview.downsampled
  };
}

export async function renderPreviewDataUrl(
  tiff: GeoTIFF,
  metadata: GeotiffRasterMetadata,
  selection: GeotiffBandSelection,
  stretch: GeotiffStretchMode,
  options: {
    imageIndex?: number;
    window?: [number, number, number, number] | null;
    maxPreviewSide?: number;
  } = {}
): Promise<{ dataUrl: string; width: number; height: number; canvas: HTMLCanvasElement }> {
  const samples = selection.grayscale
    ? [selection.red]
    : Array.from(
        new Set([selection.red, selection.green, selection.blue].filter((i) => i >= 0))
      ).sort((a, b) => a - b);

  const { bands, width, height } = await readPreviewRasters(tiff, {
    imageIndex: options.imageIndex,
    window: options.window,
    maxPreviewSide: options.maxPreviewSide,
    samples: selection.grayscale ? samples : undefined
  });

  // When grayscale requested a single sample, remap selection to index 0.
  const mappedSelection: GeotiffBandSelection = selection.grayscale
    ? { red: 0, green: 0, blue: 0, grayscale: true }
    : selection;

  const canvas = buildRgbaCanvas(bands, width, height, {
    selection: mappedSelection,
    stretch,
    nodata: metadata.nodata
  });
  return {
    dataUrl: canvasToDataUrl(canvas),
    width,
    height,
    canvas
  };
}

export function uint8ToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
