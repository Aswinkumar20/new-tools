import { LIDAR_SAMPLE_BASE64 } from '../constants/lidar-map-viewer.constants';
import {
  isLasSignature,
  looksGeographicCoords,
  parseLasFile,
  parseLasHeader
} from './lidar-las.utils';
import { base64ToUint8Array } from './lidar-map-viewer.utils';

describe('lidar-las.utils', () => {
  const sampleBytes = base64ToUint8Array(LIDAR_SAMPLE_BASE64);

  it('recognizes LASF signature on sample bytes', () => {
    expect(isLasSignature(sampleBytes)).toBe(true);
    expect(isLasSignature(new Uint8Array([0, 1, 2, 3]))).toBe(false);
  });

  it('parses LAS 1.2 header fields from sample', () => {
    const header = parseLasHeader(sampleBytes);
    expect(header.versionMajor).toBe(1);
    expect(header.versionMinor).toBe(2);
    expect(header.pointDataFormat).toBe(1);
    expect(header.pointDataRecordLength).toBe(28);
    expect(header.pointCount).toBe(256);
    expect(header.offsetToPointData).toBe(227);
    expect(header.scaleX).toBeCloseTo(0.01, 5);
    expect(header.offsetX).toBeCloseTo(-122.42, 2);
    expect(header.offsetY).toBeCloseTo(37.77, 2);
  });

  it('detects geographic-looking lon/lat bounds', () => {
    expect(looksGeographicCoords(-122.43, -122.41, 37.76, 37.78)).toBe(true);
    expect(looksGeographicCoords(500000, 501000, 4100000, 4101000)).toBe(false);
  });

  it('parses sample points with classifications and geographic coords', () => {
    const parsed = parseLasFile(sampleBytes);
    expect(parsed.points.length).toBe(256);
    expect(parsed.stats.pointCount).toBe(256);
    expect(parsed.stats.looksGeographic).toBe(true);
    expect(parsed.stats.classHistogram.length).toBeGreaterThan(0);
    expect(parsed.stats.zMax).toBeGreaterThan(parsed.stats.zMin);
    const first = parsed.points[0];
    expect(first.lon).toBeGreaterThan(-123);
    expect(first.lon).toBeLessThan(-122);
    expect(first.lat).toBeGreaterThan(37);
    expect(first.lat).toBeLessThan(38);
  });

  it('subsamples when preview cap is small', () => {
    const parsed = parseLasFile(sampleBytes, 50);
    expect(parsed.points.length).toBeLessThanOrEqual(50);
    expect(parsed.stats.subsampled).toBe(true);
    expect(parsed.warnings.some((w) => /preview/i.test(w))).toBe(true);
  });
});
