import {
  LIDAR_CLASS_COLORS,
  LIDAR_DEFAULT_PREVIEW_CAP,
  LIDAR_MAX_FILE_BYTES,
  LIDAR_SAMPLE_BASE64,
  LIDAR_SUPPORTED_EXTENSIONS
} from '../constants/lidar-map-viewer.constants';
import type {
  LidarColorMode,
  LidarLoadedFile,
  LidarPoint,
  LidarStats
} from '../types/lidar-map-viewer.types';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';
import {
  classificationLabel,
  parseLasFile
} from './lidar-las.utils';

export {
  configureLeafletDefaultIcons,
  downloadTextFile,
  loadLeaflet,
  classificationLabel,
  parseLasFile
};

export function ensureLidarStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'lidarCss');
}

export function getLidarFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function formatLidarFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateLidarFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > LIDAR_MAX_FILE_BYTES) {
    return `File is too large (max ${formatLidarFileSize(LIDAR_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function isSupportedLidarFile(file: File): boolean {
  const ext = getLidarFileExtension(file.name);
  return LIDAR_SUPPORTED_EXTENSIONS.includes(ext);
}

export function filterValidLidarFiles(files: FileList | File[]): {
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

    if (!isSupportedLidarFile(file)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .las or .laz)'
      });
      continue;
    }
    const sizeError = validateLidarFileSize(file);
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
  // Node / Jest fallback
  const buf = Buffer.from(cleaned, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export function createSampleLidarFile(): File {
  const bytes = base64ToUint8Array(LIDAR_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-block.las', {
    type: 'application/octet-stream',
    lastModified: 0
  });
}

export async function readLidarFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function createLidarFileRecord(
  file: File,
  bytes: Uint8Array,
  previewCap = LIDAR_DEFAULT_PREVIEW_CAP
): LidarLoadedFile {
  const ext = getLidarFileExtension(file.name);
  const isLaz = ext === '.laz';
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];

  if (isLaz) {
    warnings.push(
      'LAZ compressed — convert to LAS to preview. This viewer does not decompress LAZ.'
    );
    return {
      id,
      name: file.name,
      size: file.size,
      extension: ext,
      bytes,
      header: null,
      points: [],
      stats: null,
      warnings,
      isLaz: true
    };
  }

  if (file.size > 40 * 1024 * 1024) {
    warnings.push('Large LiDAR file — preview may subsample points for performance.');
  }

  try {
    const parsed = parseLasFile(bytes, previewCap);
    return {
      id,
      name: file.name,
      size: file.size,
      extension: ext,
      bytes,
      header: parsed.header,
      points: parsed.points,
      stats: parsed.stats,
      warnings: [...warnings, ...parsed.warnings],
      isLaz: false
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid LAS file';
    throw new Error(message);
  }
}

export function pointColor(
  point: LidarPoint,
  mode: LidarColorMode,
  stats: LidarStats
): string {
  if (mode === 'classification') {
    return LIDAR_CLASS_COLORS[point.classification] ?? '#64748b';
  }
  if (mode === 'intensity') {
    const span = Math.max(1, stats.intensityMax - stats.intensityMin);
    const t = (point.intensity - stats.intensityMin) / span;
    return intensityRamp(t);
  }
  const span = Math.max(1e-6, stats.zMax - stats.zMin);
  const t = (point.z - stats.zMin) / span;
  return elevationRamp(t);
}

function elevationRamp(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  if (x < 0.33) return '#0284c7';
  if (x < 0.66) return '#0d9488';
  if (x < 0.85) return '#d97706';
  return '#dc2626';
}

function intensityRamp(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  const g = Math.round(40 + x * 200);
  return `rgb(${g},${g},${g})`;
}

export function filterPointsByClass(
  points: LidarPoint[],
  enabledClasses: Set<number> | null
): LidarPoint[] {
  if (!enabledClasses || enabledClasses.size === 0) {
    return points;
  }
  return points.filter((p) => enabledClasses.has(p.classification));
}

/**
 * Render points to a canvas ImageOverlay data URL within geographic bounds.
 */
export function renderLidarCanvas(
  points: LidarPoint[],
  stats: LidarStats,
  mode: LidarColorMode,
  options: { width?: number; height?: number; pointSize?: number; opacity?: number } = {}
): { dataUrl: string; bounds: [[number, number], [number, number]] } {
  const width = options.width ?? 768;
  const height = options.height ?? 768;
  const pointSize = options.pointSize ?? 2;
  const opacity = options.opacity ?? 0.85;
  const { west, south, east, north } = stats.bounds;
  const spanX = Math.max(1e-12, east - west);
  const spanY = Math.max(1e-12, north - south);

  const canvas =
    typeof document !== 'undefined'
      ? document.createElement('canvas')
      : (null as unknown as HTMLCanvasElement);

  if (!canvas) {
    // Jest / non-DOM: return a minimal transparent PNG placeholder via empty data URL
    return {
      dataUrl: '',
      bounds: [
        [south, west],
        [north, east]
      ]
    };
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      dataUrl: '',
      bounds: [
        [south, west],
        [north, east]
      ]
    };
  }
  ctx.clearRect(0, 0, width, height);

  for (const point of points) {
    const px = ((point.lon - west) / spanX) * (width - 1);
    const py = ((north - point.lat) / spanY) * (height - 1);
    ctx.fillStyle = pointColor(point, mode, stats);
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(px, py, pointSize, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    bounds: [
      [south, west],
      [north, east]
    ]
  };
}

export function exportClassificationCsv(stats: LidarStats): string {
  const header = 'classification,label,count';
  const rows = stats.classHistogram.map((entry) =>
    [String(entry.classification), csvEscape(entry.label), String(entry.count)].join(',')
  );
  return [header, ...rows].join('\n');
}

export function exportLidarSummaryJson(file: LidarLoadedFile): string {
  return JSON.stringify(
    {
      file: {
        name: file.name,
        size: file.size,
        extension: file.extension,
        isLaz: file.isLaz,
        warnings: file.warnings
      },
      header: file.header,
      stats: file.stats
    },
    null,
    2
  );
}

export function exportPointsGeoJson(
  points: LidarPoint[],
  cap = 5000
): string {
  const sliced = points.slice(0, cap);
  return JSON.stringify(
    {
      type: 'FeatureCollection',
      features: sliced.map((p) => ({
        type: 'Feature',
        properties: {
          z: p.z,
          intensity: p.intensity,
          classification: p.classification,
          classLabel: classificationLabel(p.classification)
        },
        geometry: {
          type: 'Point',
          coordinates: [p.lon, p.lat, p.z]
        }
      }))
    },
    null,
    2
  );
}

export function downloadBinaryFile(bytes: Uint8Array, fileName: string, mime: string): void {
  if (typeof document === 'undefined') {
    throw new Error('Download is only available in the browser');
  }
  const safeName = fileName.trim() || 'download.bin';
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function canExportOriginal(file: LidarLoadedFile | null): boolean {
  return !!file && file.bytes.length > 0;
}

export function formatBoundsLabel(stats: LidarStats | null): string {
  if (!stats) return '—';
  const b = stats.bounds;
  return `${b.west.toFixed(5)}, ${b.south.toFixed(5)} → ${b.east.toFixed(5)}, ${b.north.toFixed(5)}`;
}

export function resolveLidarSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  isLaz: boolean;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'lidar-error',
      title: 'Need a LAS point cloud?',
      reason: 'Upload an uncompressed .las file (formats 0–3). Convert .laz to .las first.',
      actionLabel: 'Related: DEM Viewer',
      path: '/gis-viewers/dem-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'lidar-intro',
      title: 'Start with a LAS block',
      reason:
        'Drop a .las file or load the sample to explore classification, elevation, and intensity on a 2D map.',
      actionLabel: 'Related: Contour Map',
      path: '/gis-viewers/contour-map-viewer'
    };
  }
  if (state.isLaz) {
    return {
      id: 'lidar-laz',
      title: 'Convert LAZ to LAS',
      reason:
        'Compressed LAZ is not expanded here. For 3D orbit of large clouds, try Point Cloud Viewer.',
      actionLabel: 'Point Cloud Viewer',
      path: '/gis-viewers/point-cloud-viewer'
    };
  }
  return null;
}
