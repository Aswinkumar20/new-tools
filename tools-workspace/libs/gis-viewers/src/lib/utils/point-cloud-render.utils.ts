import type {
  PointCloudCamera,
  PointCloudColorMode,
  PointCloudPoint,
  PointCloudStats,
  PointCloudVec3
} from '../types/point-cloud-viewer.types';
import { LIDAR_CLASS_COLORS } from '../constants/lidar-map-viewer.constants';

export const DEFAULT_POINT_CLOUD_CAMERA: PointCloudCamera = {
  yaw: 0.6,
  pitch: 0.45,
  distance: 2.4,
  panX: 0,
  panY: 0
};

export function normalizePointCloudCamera(camera: Partial<PointCloudCamera>): PointCloudCamera {
  const pitch = Math.max(-1.2, Math.min(1.2, camera.pitch ?? DEFAULT_POINT_CLOUD_CAMERA.pitch));
  const distance = Math.max(0.35, Math.min(40, camera.distance ?? DEFAULT_POINT_CLOUD_CAMERA.distance));
  return {
    yaw: camera.yaw ?? DEFAULT_POINT_CLOUD_CAMERA.yaw,
    pitch,
    distance,
    panX: camera.panX ?? 0,
    panY: camera.panY ?? 0
  };
}

/** Center and scale points into a unit-ish cube for stable orbit. */
export function normalizePointsForView(
  points: PointCloudPoint[],
  stats: PointCloudStats
): PointCloudPoint[] {
  const b = stats.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const span = Math.max(
    1e-6,
    b.maxX - b.minX,
    b.maxY - b.minY,
    b.maxZ - b.minZ
  );
  const scale = 2 / span;
  return points.map((p) => ({
    ...p,
    x: (p.x - cx) * scale,
    y: (p.y - cy) * scale,
    z: (p.z - cz) * scale
  }));
}

export function rotateYawPitch(
  point: PointCloudVec3,
  yaw: number,
  pitch: number
): PointCloudVec3 {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x1 = point.x * cosY - point.y * sinY;
  const y1 = point.x * sinY + point.y * cosY;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const y2 = y1 * cosP - point.z * sinP;
  const z2 = y1 * sinP + point.z * cosP;
  return { x: x1, y: y2, z: z2 };
}

/**
 * Perspective project a camera-space point onto canvas pixels.
 * Camera looks toward origin along +Z after rotation; distance pulls camera back.
 */
export function projectPerspective(
  point: PointCloudVec3,
  camera: PointCloudCamera,
  width: number,
  height: number,
  fov = 1.1
): { x: number; y: number; depth: number } | null {
  const rotated = rotateYawPitch(point, camera.yaw, camera.pitch);
  const zCam = rotated.z + camera.distance;
  if (zCam <= 0.05) {
    return null;
  }
  const f = (Math.min(width, height) * 0.5) / Math.tan(fov / 2);
  const x = width / 2 + ((rotated.x + camera.panX) * f) / zCam;
  const y = height / 2 - ((rotated.y + camera.panY) * f) / zCam;
  return { x, y, depth: zCam };
}

export function pointCloudColor(
  point: PointCloudPoint,
  mode: PointCloudColorMode,
  stats: PointCloudStats,
  originalZ?: number
): string {
  if (mode === 'rgb' && point.r != null && point.g != null && point.b != null) {
    return `rgb(${point.r},${point.g},${point.b})`;
  }
  if (mode === 'classification') {
    return LIDAR_CLASS_COLORS[point.classification] ?? '#64748b';
  }
  if (mode === 'intensity') {
    const span = Math.max(1, stats.intensityMax - stats.intensityMin);
    const t = (point.intensity - stats.intensityMin) / span;
    return intensityRamp(t);
  }
  const z = originalZ ?? point.z;
  const span = Math.max(1e-6, stats.zMax - stats.zMin);
  const t = (z - stats.zMin) / span;
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

export function filterPointsByZClip(
  points: PointCloudPoint[],
  minZ: number,
  maxZ: number
): PointCloudPoint[] {
  const lo = Math.min(minZ, maxZ);
  const hi = Math.max(minZ, maxZ);
  return points.filter((p) => p.z >= lo && p.z <= hi);
}

export function renderPointCloudCanvas(
  points: PointCloudPoint[],
  stats: PointCloudStats,
  camera: PointCloudCamera,
  mode: PointCloudColorMode,
  options: {
    width?: number;
    height?: number;
    pointSize?: number;
    opacity?: number;
    /** Original (unnormalized) points for elevation/intensity color when points are view-normalized. */
    colorSource?: PointCloudPoint[];
  } = {}
): string {
  const width = options.width ?? 800;
  const height = options.height ?? 560;
  const pointSize = options.pointSize ?? 2;
  const opacity = options.opacity ?? 0.9;
  const cam = normalizePointCloudCamera(camera);

  if (typeof document === 'undefined') {
    return '';
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return '';
  }

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  const projected: Array<{ x: number; y: number; depth: number; color: string }> = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const screen = projectPerspective(p, cam, width, height);
    if (!screen) continue;
    const src = options.colorSource?.[i] ?? p;
    projected.push({
      x: screen.x,
      y: screen.y,
      depth: screen.depth,
      color: pointCloudColor(src, mode, stats, src.z)
    });
  }
  projected.sort((a, b) => b.depth - a.depth);

  ctx.globalAlpha = opacity;
  for (const pt of projected) {
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pointSize, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toDataURL('image/png');
}

export function applyOrbitDelta(
  camera: PointCloudCamera,
  dx: number,
  dy: number,
  sensitivity = 0.005
): PointCloudCamera {
  return normalizePointCloudCamera({
    ...camera,
    yaw: camera.yaw + dx * sensitivity,
    pitch: camera.pitch + dy * sensitivity
  });
}

export function applyPanDelta(
  camera: PointCloudCamera,
  dx: number,
  dy: number,
  sensitivity = 0.002
): PointCloudCamera {
  const scale = camera.distance * sensitivity;
  return normalizePointCloudCamera({
    ...camera,
    panX: camera.panX + dx * scale,
    panY: camera.panY - dy * scale
  });
}

export function applyZoomDelta(
  camera: PointCloudCamera,
  deltaY: number,
  factor = 0.0015
): PointCloudCamera {
  const next = camera.distance * (1 + deltaY * factor);
  return normalizePointCloudCamera({ ...camera, distance: next });
}
