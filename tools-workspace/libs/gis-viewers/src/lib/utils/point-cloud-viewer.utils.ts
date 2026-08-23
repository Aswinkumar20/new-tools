import {
  POINT_CLOUD_DEFAULT_PREVIEW_CAP,
  POINT_CLOUD_MAX_FILE_BYTES,
  POINT_CLOUD_SAMPLE_PLY,
  POINT_CLOUD_SOFT_FAIL_EXTENSIONS,
  POINT_CLOUD_SUPPORTED_EXTENSIONS
} from '../constants/point-cloud-viewer.constants';
import type {
  PointCloudBounds,
  PointCloudLoadedFile,
  PointCloudPoint,
  PointCloudSourceFormat,
  PointCloudStats
} from '../types/point-cloud-viewer.types';
import { parseLasFile } from './lidar-las.utils';
import { downloadTextFile } from './leaflet-map.utils';

export { downloadTextFile, parseLasFile };

export function getPointCloudFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function formatPointCloudFileSize(bytes: number): string {
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

export function validatePointCloudFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > POINT_CLOUD_MAX_FILE_BYTES) {
    return `File is too large (max ${formatPointCloudFileSize(POINT_CLOUD_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function isSupportedPointCloudFile(file: File): boolean {
  const ext = getPointCloudFileExtension(file.name);
  return POINT_CLOUD_SUPPORTED_EXTENSIONS.includes(ext);
}

export function filterValidPointCloudFiles(files: FileList | File[]): {
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

    if (!isSupportedPointCloudFile(file)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .las, .ply, .pcd; .laz/.e57 soft-warn)'
      });
      continue;
    }
    const sizeError = validatePointCloudFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function bytesToText(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

export function createSamplePointCloudFile(): File {
  const text = POINT_CLOUD_SAMPLE_PLY;
  return new File([text], 'sample-cloud.ply', {
    type: 'text/plain',
    lastModified: 0
  });
}

export async function readPointCloudFileBytes(file: File): Promise<Uint8Array> {
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

function subsampleStride(total: number, cap: number): number {
  if (total <= cap) return 1;
  return Math.ceil(total / cap);
}

function subsamplePoints(
  points: PointCloudPoint[],
  cap: number
): { points: PointCloudPoint[]; warnings: string[] } {
  const warnings: string[] = [];
  const stride = subsampleStride(points.length, cap);
  if (stride <= 1) {
    return { points, warnings };
  }
  const out: PointCloudPoint[] = [];
  for (let i = 0; i < points.length; i += stride) {
    out.push(points[i]);
  }
  warnings.push(
    `Showing ${out.length.toLocaleString()} of ${points.length.toLocaleString()} points (cap ${cap.toLocaleString()}).`
  );
  return { points: out, warnings };
}

export function computePointCloudBounds(points: PointCloudPoint[]): PointCloudBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

export function buildPointCloudStats(
  points: PointCloudPoint[],
  totalDeclared: number,
  sourceFormat: PointCloudSourceFormat,
  formatLabel: string
): PointCloudStats {
  const bounds = computePointCloudBounds(points);
  let intensityMin = Infinity;
  let intensityMax = -Infinity;
  let hasRgb = false;
  let hasIntensity = false;
  let hasClassification = false;
  for (const p of points) {
    intensityMin = Math.min(intensityMin, p.intensity);
    intensityMax = Math.max(intensityMax, p.intensity);
    if (p.intensity !== 0) hasIntensity = true;
    if (p.classification !== 0 && p.classification !== 1) hasClassification = true;
    if (p.classification > 0) hasClassification = true;
    if (p.r != null && p.g != null && p.b != null) hasRgb = true;
  }
  if (!Number.isFinite(intensityMin)) {
    intensityMin = 0;
    intensityMax = 0;
  }
  // Intensity present if any non-default variance or RGB-less clouds often store it
  if (intensityMax > intensityMin) {
    hasIntensity = true;
  }
  return {
    pointCount: totalDeclared,
    previewCount: points.length,
    subsampled: points.length < totalDeclared,
    bounds,
    zMin: bounds.minZ,
    zMax: bounds.maxZ,
    intensityMin,
    intensityMax,
    hasRgb,
    hasIntensity,
    hasClassification,
    sourceFormat,
    formatLabel
  };
}

/**
 * Parse ASCII PLY with float x/y/z and optional intensity / rgb / uchar class.
 */
export function parseAsciiPly(
  text: string,
  previewCap = POINT_CLOUD_DEFAULT_PREVIEW_CAP
): { points: PointCloudPoint[]; warnings: string[]; total: number } {
  const warnings: string[] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (!lines[0] || lines[0].trim().toLowerCase() !== 'ply') {
    throw new Error('Not a PLY file — missing ply signature');
  }

  let format = '';
  let vertexCount = 0;
  const props: string[] = [];
  let headerEnd = -1;
  let inVertex = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    const lower = line.toLowerCase();
    if (lower.startsWith('format ')) {
      format = lower.slice(7).trim();
    } else if (lower.startsWith('element vertex ')) {
      vertexCount = Number(line.split(/\s+/)[2]);
      inVertex = true;
    } else if (lower.startsWith('element ')) {
      inVertex = false;
    } else if (inVertex && lower.startsWith('property ')) {
      const parts = line.split(/\s+/);
      props.push(parts[parts.length - 1].toLowerCase());
    } else if (lower === 'end_header') {
      headerEnd = i;
      break;
    }
  }

  if (headerEnd < 0) {
    throw new Error('PLY header is incomplete (missing end_header)');
  }
  if (!format.includes('ascii')) {
    throw new Error('Only ASCII PLY is supported in this viewer');
  }
  if (!Number.isFinite(vertexCount) || vertexCount <= 0) {
    throw new Error('PLY declares no vertices');
  }

  const idx = {
    x: props.indexOf('x'),
    y: props.indexOf('y'),
    z: props.indexOf('z'),
    intensity: props.findIndex((p) => p === 'intensity' || p === 'scalar_intensity'),
    r: props.findIndex((p) => p === 'red' || p === 'r'),
    g: props.findIndex((p) => p === 'green' || p === 'g'),
    b: props.findIndex((p) => p === 'blue' || p === 'b'),
    classification: props.findIndex(
      (p) => p === 'classification' || p === 'class' || p === 'label'
    )
  };
  if (idx.x < 0 || idx.y < 0 || idx.z < 0) {
    throw new Error('PLY must include x, y, z properties');
  }

  const dataLines = lines.slice(headerEnd + 1).filter((l) => l.trim().length > 0);
  const total = Math.min(vertexCount, dataLines.length);
  const stride = subsampleStride(total, previewCap);
  if (stride > 1) {
    warnings.push(
      `Showing ${Math.ceil(total / stride).toLocaleString()} of ${total.toLocaleString()} points for 3D preview (cap ${previewCap.toLocaleString()}).`
    );
  }

  const points: PointCloudPoint[] = [];
  for (let i = 0; i < total; i += stride) {
    const parts = dataLines[i].trim().split(/\s+/);
    const x = Number(parts[idx.x]);
    const y = Number(parts[idx.y]);
    const z = Number(parts[idx.z]);
    if (![x, y, z].every(Number.isFinite)) continue;
    const intensity =
      idx.intensity >= 0 ? Number(parts[idx.intensity]) || 0 : Math.round(z * 100);
    const classification =
      idx.classification >= 0 ? Number(parts[idx.classification]) || 0 : 0;
    const point: PointCloudPoint = { x, y, z, intensity, classification };
    if (idx.r >= 0 && idx.g >= 0 && idx.b >= 0) {
      point.r = Math.max(0, Math.min(255, Number(parts[idx.r]) || 0));
      point.g = Math.max(0, Math.min(255, Number(parts[idx.g]) || 0));
      point.b = Math.max(0, Math.min(255, Number(parts[idx.b]) || 0));
    }
    points.push(point);
  }

  if (points.length === 0) {
    throw new Error('PLY contained no readable vertices');
  }
  if (idx.r < 0) {
    warnings.push('No RGB properties in PLY — color by intensity or elevation instead.');
  }
  return { points, warnings, total };
}

/**
 * Simple ASCII PCD (FIELDS x y z [intensity] [rgb] … DATA ascii).
 */
export function parseAsciiPcd(
  text: string,
  previewCap = POINT_CLOUD_DEFAULT_PREVIEW_CAP
): { points: PointCloudPoint[]; warnings: string[]; total: number } {
  const warnings: string[] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  let fields: string[] = [];
  let pointsDeclared = 0;
  let dataStart = -1;
  let dataType = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const upper = line.toUpperCase();
    if (upper.startsWith('FIELDS ')) {
      fields = line.slice(7).trim().split(/\s+/).map((f) => f.toLowerCase());
    } else if (upper.startsWith('POINTS ')) {
      pointsDeclared = Number(line.split(/\s+/)[1]);
    } else if (upper.startsWith('DATA ')) {
      dataType = line.slice(5).trim().toLowerCase();
      dataStart = i;
      break;
    }
  }

  if (dataStart < 0) {
    throw new Error('PCD header is incomplete (missing DATA)');
  }
  if (dataType !== 'ascii') {
    throw new Error('Only ASCII PCD is supported in this viewer');
  }
  if (fields.indexOf('x') < 0 || fields.indexOf('y') < 0 || fields.indexOf('z') < 0) {
    throw new Error('PCD must include x y z fields');
  }

  const ix = fields.indexOf('x');
  const iy = fields.indexOf('y');
  const iz = fields.indexOf('z');
  const iIntensity = fields.indexOf('intensity');
  const iRgb = fields.indexOf('rgb');
  const iR = fields.indexOf('r') >= 0 ? fields.indexOf('r') : fields.indexOf('red');
  const iG = fields.indexOf('g') >= 0 ? fields.indexOf('g') : fields.indexOf('green');
  const iB = fields.indexOf('b') >= 0 ? fields.indexOf('b') : fields.indexOf('blue');

  const dataLines = lines.slice(dataStart + 1).filter((l) => l.trim().length > 0);
  const total = Math.min(pointsDeclared || dataLines.length, dataLines.length);
  const stride = subsampleStride(total, previewCap);
  if (stride > 1) {
    warnings.push(
      `Showing ${Math.ceil(total / stride).toLocaleString()} of ${total.toLocaleString()} points for 3D preview (cap ${previewCap.toLocaleString()}).`
    );
  }

  const points: PointCloudPoint[] = [];
  for (let i = 0; i < total; i += stride) {
    const parts = dataLines[i].trim().split(/\s+/);
    const x = Number(parts[ix]);
    const y = Number(parts[iy]);
    const z = Number(parts[iz]);
    if (![x, y, z].every(Number.isFinite)) continue;
    const intensity = iIntensity >= 0 ? Number(parts[iIntensity]) || 0 : 0;
    const point: PointCloudPoint = { x, y, z, intensity, classification: 0 };
    if (iR >= 0 && iG >= 0 && iB >= 0) {
      point.r = Math.max(0, Math.min(255, Number(parts[iR]) || 0));
      point.g = Math.max(0, Math.min(255, Number(parts[iG]) || 0));
      point.b = Math.max(0, Math.min(255, Number(parts[iB]) || 0));
    } else if (iRgb >= 0) {
      const packed = Number(parts[iRgb]);
      if (Number.isFinite(packed)) {
        const rgb = unpackPcdRgb(packed);
        point.r = rgb.r;
        point.g = rgb.g;
        point.b = rgb.b;
      }
    }
    points.push(point);
  }

  if (points.length === 0) {
    throw new Error('PCD contained no readable points');
  }
  if (iR < 0 && iRgb < 0) {
    warnings.push('No RGB fields in PCD — color by intensity or elevation instead.');
  }
  return { points, warnings, total };
}

function unpackPcdRgb(packed: number): { r: number; g: number; b: number } {
  // PCL often stores RGB as float bit-cast; also accept integer 0xRRGGBB
  let intVal = packed;
  if (!Number.isInteger(packed)) {
    const buf = new ArrayBuffer(4);
    new Float32Array(buf)[0] = packed;
    intVal = new Uint32Array(buf)[0];
  }
  const v = intVal >>> 0;
  return {
    r: (v >> 16) & 0xff,
    g: (v >> 8) & 0xff,
    b: v & 0xff
  };
}

export function sourceFormatFromExtension(ext: string): PointCloudSourceFormat {
  switch (ext) {
    case '.las':
      return 'las';
    case '.ply':
      return 'ply';
    case '.pcd':
      return 'pcd';
    case '.laz':
      return 'laz';
    case '.e57':
      return 'e57';
    default:
      return 'unknown';
  }
}

export function createPointCloudFileRecord(
  file: File,
  bytes: Uint8Array,
  previewCap = POINT_CLOUD_DEFAULT_PREVIEW_CAP
): PointCloudLoadedFile {
  const ext = getPointCloudFileExtension(file.name);
  const sourceFormat = sourceFormatFromExtension(ext);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];

  if (POINT_CLOUD_SOFT_FAIL_EXTENSIONS.includes(ext)) {
    if (ext === '.laz') {
      warnings.push(
        'LAZ compressed — convert to LAS (or ASCII PLY/PCD) to orbit in 3D. This viewer does not decompress LAZ.'
      );
    } else {
      warnings.push(
        'E57 is not parsed here — export to LAS, PLY, or PCD to view. Soft-fail only.'
      );
    }
    return {
      id,
      name: file.name,
      size: file.size,
      extension: ext,
      bytes,
      points: [],
      stats: null,
      warnings,
      softFail: true,
      sourceFormat
    };
  }

  if (file.size > 40 * 1024 * 1024) {
    warnings.push('Large point cloud — preview may subsample points for performance.');
  }

  try {
    if (ext === '.las') {
      const parsed = parseLasFile(bytes, previewCap);
      const points: PointCloudPoint[] = parsed.points.map((p) => ({
        x: p.x,
        y: p.y,
        z: p.z,
        intensity: p.intensity,
        classification: p.classification
      }));
      const stats = buildPointCloudStats(
        points,
        parsed.stats.pointCount,
        'las',
        `LAS ${parsed.stats.version} fmt ${parsed.stats.pointFormat}`
      );
      stats.hasClassification = parsed.stats.classHistogram.length > 0;
      stats.hasIntensity = parsed.stats.intensityMax > parsed.stats.intensityMin;
      if (!stats.hasRgb) {
        warnings.push('LAS has no RGB channels — use intensity, elevation, or classification.');
      }
      return {
        id,
        name: file.name,
        size: file.size,
        extension: ext,
        bytes,
        points,
        stats,
        warnings: [...warnings, ...parsed.warnings],
        softFail: false,
        sourceFormat: 'las'
      };
    }

    const text = bytesToText(bytes);
    const parsed =
      ext === '.pcd' ? parseAsciiPcd(text, previewCap) : parseAsciiPly(text, previewCap);
    const stats = buildPointCloudStats(
      parsed.points,
      parsed.total,
      sourceFormat,
      ext === '.pcd' ? 'ASCII PCD' : 'ASCII PLY'
    );
    return {
      id,
      name: file.name,
      size: file.size,
      extension: ext,
      bytes,
      points: parsed.points,
      stats,
      warnings: [...warnings, ...parsed.warnings],
      softFail: false,
      sourceFormat
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid point cloud file';
    throw new Error(message);
  }
}

export function exportPointCloudSummaryJson(file: PointCloudLoadedFile): string {
  return JSON.stringify(
    {
      file: {
        name: file.name,
        size: file.size,
        extension: file.extension,
        sourceFormat: file.sourceFormat,
        softFail: file.softFail,
        warnings: file.warnings
      },
      stats: file.stats
    },
    null,
    2
  );
}

export function exportXyzCsv(points: PointCloudPoint[], cap = 50000): string {
  const header = 'x,y,z,intensity,classification,r,g,b';
  const sliced = points.slice(0, cap);
  const rows = sliced.map((p) =>
    [
      p.x,
      p.y,
      p.z,
      p.intensity,
      p.classification,
      p.r ?? '',
      p.g ?? '',
      p.b ?? ''
    ].join(',')
  );
  return [header, ...rows].join('\n');
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

export function canExportPointCloud(file: PointCloudLoadedFile | null): boolean {
  return !!file && file.bytes.length > 0;
}

export function formatBoundsLabel(stats: PointCloudStats | null): string {
  if (!stats) return '—';
  const b = stats.bounds;
  return `${b.minX.toFixed(3)}, ${b.minY.toFixed(3)}, ${b.minZ.toFixed(3)} → ${b.maxX.toFixed(3)}, ${b.maxY.toFixed(3)}, ${b.maxZ.toFixed(3)}`;
}

export function resolvePointCloudSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  softFail: boolean;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'point-cloud-error',
      title: 'Need a readable cloud?',
      reason: 'Upload ASCII PLY/PCD or uncompressed LAS (formats 0–3). Convert LAZ/E57 first.',
      actionLabel: 'Related: LiDAR Map',
      path: '/gis-viewers/lidar-map-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'point-cloud-intro',
      title: 'Start with a point cloud',
      reason:
        'Drop a .ply, .pcd, or .las file — or load the sample — to orbit, clip by Z, and color by intensity.',
      actionLabel: 'Related: LiDAR Map',
      path: '/gis-viewers/lidar-map-viewer'
    };
  }
  if (state.softFail) {
    return {
      id: 'point-cloud-softfail',
      title: 'Convert LAZ / E57',
      reason: 'This format is listed but not decoded here. Export to LAS or ASCII PLY for 3D orbit.',
      actionLabel: 'LiDAR Map Viewer',
      path: '/gis-viewers/lidar-map-viewer'
    };
  }
  return null;
}
