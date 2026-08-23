/**
 * Pure TypeScript ASPRS LAS 1.2 reader (point data record formats 0–3).
 * Does not decompress LAZ — callers should soft-warn and ask for .las.
 */

import {
  LIDAR_CLASS_LABELS,
  LIDAR_DEFAULT_PREVIEW_CAP
} from '../constants/lidar-map-viewer.constants';
import type {
  LidarBounds,
  LidarClassHistogramEntry,
  LidarLasHeader,
  LidarParseResult,
  LidarPoint,
  LidarStats
} from '../types/lidar-map-viewer.types';

const LAS_SIGNATURE = 'LASF';

/** Record lengths for formats 0–3 (LAS 1.2). */
export const LAS_FORMAT_RECORD_LENGTHS: Readonly<Record<number, number>> = {
  0: 20,
  1: 28,
  2: 26,
  3: 34
};

function readCString(view: DataView, offset: number, length: number): string {
  const bytes: number[] = [];
  for (let i = 0; i < length; i++) {
    const b = view.getUint8(offset + i);
    if (b === 0) break;
    bytes.push(b);
  }
  return String.fromCharCode(...bytes).trim();
}

export function isLasSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return (
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === LAS_SIGNATURE
  );
}

export function parseLasHeader(bytes: Uint8Array): LidarLasHeader {
  if (bytes.length < 227) {
    throw new Error('LAS file is too small to contain a valid header');
  }
  if (!isLasSignature(bytes)) {
    throw new Error('Not a LAS file — missing LASF signature');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const versionMajor = view.getUint8(24);
  const versionMinor = view.getUint8(25);
  const headerSize = view.getUint16(94, true);
  const offsetToPointData = view.getUint32(96, true);
  const pointDataFormat = view.getUint8(104);
  const pointDataRecordLength = view.getUint16(105, true);
  const pointCount = view.getUint32(107, true);

  return {
    versionMajor,
    versionMinor,
    systemIdentifier: readCString(view, 26, 32),
    generatingSoftware: readCString(view, 58, 32),
    headerSize,
    offsetToPointData,
    pointDataFormat,
    pointDataRecordLength,
    pointCount,
    scaleX: view.getFloat64(131, true),
    scaleY: view.getFloat64(139, true),
    scaleZ: view.getFloat64(147, true),
    offsetX: view.getFloat64(155, true),
    offsetY: view.getFloat64(163, true),
    offsetZ: view.getFloat64(171, true),
    maxX: view.getFloat64(179, true),
    minX: view.getFloat64(187, true),
    maxY: view.getFloat64(195, true),
    minY: view.getFloat64(203, true),
    maxZ: view.getFloat64(211, true),
    minZ: view.getFloat64(219, true)
  };
}

/**
 * Detect lon/lat-style geographic coordinates (vs projected meters like UTM).
 * Sample uses offset around SF (-122, 37).
 */
export function looksGeographicCoords(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): boolean {
  const inLon = minX >= -180 && maxX <= 180 && Math.abs(maxX - minX) < 2;
  const inLat = minY >= -90 && maxY <= 90 && Math.abs(maxY - minY) < 2;
  return inLon && inLat;
}

export function classificationLabel(code: number): string {
  return LIDAR_CLASS_LABELS[code] ?? `Class ${code}`;
}

function subsampleStride(total: number, cap: number): number {
  if (total <= cap) return 1;
  return Math.ceil(total / cap);
}

/**
 * Read points for formats 0–3.
 * Layout (common prefix): X i32, Y i32, Z i32, Intensity u16, ReturnInfo u8, Classification u8, …
 */
export function parseLasPoints(
  bytes: Uint8Array,
  header: LidarLasHeader,
  previewCap = LIDAR_DEFAULT_PREVIEW_CAP
): { points: LidarPoint[]; warnings: string[] } {
  const warnings: string[] = [];
  const fmt = header.pointDataFormat;
  if (fmt < 0 || fmt > 3) {
    throw new Error(
      `Unsupported LAS point format ${fmt} — this viewer supports formats 0–3`
    );
  }

  const expectedLen = LAS_FORMAT_RECORD_LENGTHS[fmt];
  const recordLen = header.pointDataRecordLength || expectedLen;
  if (recordLen < expectedLen) {
    throw new Error(
      `Point record length ${recordLen} is too short for format ${fmt} (need ≥ ${expectedLen})`
    );
  }

  const start = header.offsetToPointData;
  if (start >= bytes.length) {
    throw new Error('Offset to point data is past end of file');
  }

  const available = Math.floor((bytes.length - start) / recordLen);
  const declared = header.pointCount > 0 ? header.pointCount : available;
  const total = Math.min(declared, available);
  if (total === 0) {
    throw new Error('LAS file contains no point records');
  }
  if (declared > available) {
    warnings.push(
      `Header claims ${declared} points but only ${available} fit in the file — reading ${available}.`
    );
  }

  const stride = subsampleStride(total, previewCap);
  if (stride > 1) {
    warnings.push(
      `Showing ${Math.ceil(total / stride).toLocaleString()} of ${total.toLocaleString()} points for map preview (cap ${previewCap.toLocaleString()}).`
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const geographic = looksGeographicCoords(
    header.minX,
    header.maxX,
    header.minY,
    header.maxY
  );
  if (!geographic) {
    warnings.push(
      'Coordinates may be projected (not lon/lat); map overlay is approximate.'
    );
  }

  const points: LidarPoint[] = [];
  for (let i = 0; i < total; i += stride) {
    const off = start + i * recordLen;
    if (off + 18 > bytes.length) break;
    const xi = view.getInt32(off, true);
    const yi = view.getInt32(off + 4, true);
    const zi = view.getInt32(off + 8, true);
    const intensity = view.getUint16(off + 12, true);
    const classification = view.getUint8(off + 15) & 0x1f;
    const x = xi * header.scaleX + header.offsetX;
    const y = yi * header.scaleY + header.offsetY;
    const z = zi * header.scaleZ + header.offsetZ;
    points.push({
      x,
      y,
      z,
      intensity,
      classification,
      lon: x,
      lat: y
    });
  }

  return { points, warnings };
}

export function buildClassHistogram(points: LidarPoint[]): LidarClassHistogramEntry[] {
  const counts = new Map<number, number>();
  for (const p of points) {
    counts.set(p.classification, (counts.get(p.classification) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([classification, count]) => ({
      classification,
      label: classificationLabel(classification),
      count
    }));
}

export function computeLidarBounds(points: LidarPoint[]): LidarBounds {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    west = Math.min(west, p.lon);
    east = Math.max(east, p.lon);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return { west, south, east, north, minZ, maxZ };
}

function estimateDensityPerSqM(bounds: LidarBounds, count: number): number | null {
  if (!looksGeographicCoords(bounds.west, bounds.east, bounds.south, bounds.north)) {
    const area =
      Math.max(1e-6, bounds.east - bounds.west) * Math.max(1e-6, bounds.north - bounds.south);
    return count / area;
  }
  // Rough geographic: meters ≈ degrees * 111320 (lat) and cos(lat)*111320 (lon)
  const midLat = ((bounds.south + bounds.north) / 2) * (Math.PI / 180);
  const widthM = Math.abs(bounds.east - bounds.west) * 111320 * Math.cos(midLat);
  const heightM = Math.abs(bounds.north - bounds.south) * 111320;
  const area = Math.max(1e-6, widthM * heightM);
  return count / area;
}

export function buildLidarStats(
  header: LidarLasHeader,
  points: LidarPoint[],
  totalDeclared: number,
  subsampled: boolean
): LidarStats {
  const bounds = computeLidarBounds(points);
  let intensityMin = Infinity;
  let intensityMax = -Infinity;
  for (const p of points) {
    intensityMin = Math.min(intensityMin, p.intensity);
    intensityMax = Math.max(intensityMax, p.intensity);
  }
  if (!Number.isFinite(intensityMin)) {
    intensityMin = 0;
    intensityMax = 0;
  }
  const geographic = looksGeographicCoords(
    header.minX,
    header.maxX,
    header.minY,
    header.maxY
  );
  return {
    pointCount: totalDeclared,
    previewCount: points.length,
    subsampled,
    pointFormat: header.pointDataFormat,
    pointRecordLength: header.pointDataRecordLength,
    scale: { x: header.scaleX, y: header.scaleY, z: header.scaleZ },
    offset: { x: header.offsetX, y: header.offsetY, z: header.offsetZ },
    bounds,
    zMin: bounds.minZ,
    zMax: bounds.maxZ,
    intensityMin,
    intensityMax,
    classHistogram: buildClassHistogram(points),
    densityPerSqM: estimateDensityPerSqM(bounds, points.length),
    looksGeographic: geographic,
    version: `${header.versionMajor}.${header.versionMinor}`,
    systemIdentifier: header.systemIdentifier,
    generatingSoftware: header.generatingSoftware
  };
}

export function parseLasFile(
  bytes: Uint8Array,
  previewCap = LIDAR_DEFAULT_PREVIEW_CAP
): LidarParseResult {
  const header = parseLasHeader(bytes);
  const { points, warnings } = parseLasPoints(bytes, header, previewCap);
  const available = Math.floor(
    (bytes.length - header.offsetToPointData) /
      Math.max(1, header.pointDataRecordLength)
  );
  const total = Math.min(header.pointCount || available, available);
  const subsampled = points.length < total;
  const stats = buildLidarStats(header, points, total, subsampled);
  return { header, points, stats, warnings };
}
