import {
  applyOrbitDelta,
  applyPanDelta,
  applyZoomDelta,
  filterPointsByZClip,
  normalizePointCloudCamera,
  normalizePointsForView,
  projectPerspective,
  rotateYawPitch
} from './point-cloud-render.utils';
import type { PointCloudPoint, PointCloudStats } from '../types/point-cloud-viewer.types';

describe('point-cloud-render.utils', () => {
  const stats: PointCloudStats = {
    pointCount: 2,
    previewCount: 2,
    subsampled: false,
    bounds: { minX: 0, maxX: 2, minY: 0, maxY: 2, minZ: 0, maxZ: 2 },
    zMin: 0,
    zMax: 2,
    intensityMin: 0,
    intensityMax: 100,
    hasRgb: false,
    hasIntensity: true,
    hasClassification: false,
    sourceFormat: 'ply',
    formatLabel: 'ASCII PLY'
  };

  it('projects points with perspective and depth', () => {
    const cam = normalizePointCloudCamera({ yaw: 0, pitch: 0, distance: 3, panX: 0, panY: 0 });
    const screen = projectPerspective({ x: 0, y: 0, z: 0 }, cam, 800, 600);
    expect(screen).not.toBeNull();
    expect(screen!.x).toBeCloseTo(400, 0);
    expect(screen!.y).toBeCloseTo(300, 0);
    expect(screen!.depth).toBeGreaterThan(0);
  });

  it('rotates yaw/pitch and normalizes view bounds', () => {
    const rotated = rotateYawPitch({ x: 1, y: 0, z: 0 }, Math.PI / 2, 0);
    expect(rotated.x).toBeCloseTo(0, 5);
    expect(rotated.y).toBeCloseTo(1, 5);
    const points: PointCloudPoint[] = [
      { x: 0, y: 0, z: 0, intensity: 1, classification: 0 },
      { x: 2, y: 2, z: 2, intensity: 2, classification: 0 }
    ];
    const normalized = normalizePointsForView(points, stats);
    expect(normalized[0].x).toBeCloseTo(-1, 5);
    expect(normalized[1].x).toBeCloseTo(1, 5);
  });

  it('applies orbit/pan/zoom and Z clip', () => {
    const cam = normalizePointCloudCamera({});
    const orbited = applyOrbitDelta(cam, 100, 0);
    expect(orbited.yaw).toBeGreaterThan(cam.yaw);
    const panned = applyPanDelta(cam, 50, 0);
    expect(panned.panX).not.toBe(cam.panX);
    const zoomed = applyZoomDelta(cam, 200);
    expect(zoomed.distance).toBeGreaterThan(cam.distance);
    const clipped = filterPointsByZClip(
      [
        { x: 0, y: 0, z: 0.5, intensity: 1, classification: 0 },
        { x: 0, y: 0, z: 9, intensity: 1, classification: 0 }
      ],
      0,
      1
    );
    expect(clipped).toHaveLength(1);
  });
});
