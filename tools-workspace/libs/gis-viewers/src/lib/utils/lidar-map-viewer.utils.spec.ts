import {
  createLidarFileRecord,
  createSampleLidarFile,
  exportClassificationCsv,
  filterValidLidarFiles,
  formatLidarFileSize,
  resolveLidarSuggestion
} from './lidar-map-viewer.utils';
import { readLidarFileBytes } from './lidar-map-viewer.utils';

describe('lidar-map-viewer.utils', () => {
  it('formats sizes and filters files including duplicates and unsupported', () => {
    expect(formatLidarFileSize(1024)).toBe('1.0 KB');
    const las = new File([new Uint8Array([1])], 'a.las', { lastModified: 0 });
    const laz = new File([new Uint8Array([1])], 'b.laz', { lastModified: 0 });
    const bad = new File([new Uint8Array([1])], 'c.ply', { lastModified: 0 });
    const dup = new File([new Uint8Array([1])], 'a.las', { lastModified: 0 });
    const result = filterValidLidarFiles([las, laz, bad, dup]);
    expect(result.accepted).toHaveLength(2);
    expect(result.rejected.length).toBeGreaterThanOrEqual(2);
  });

  it('creates sample with lastModified 0 and parses via file record', async () => {
    const sample = createSampleLidarFile();
    expect(sample.name).toBe('sample-block.las');
    expect(sample.lastModified).toBe(0);
    const bytes = await readLidarFileBytes(sample);
    const record = createLidarFileRecord(sample, bytes);
    expect(record.isLaz).toBe(false);
    expect(record.points.length).toBe(256);
    expect(record.stats?.looksGeographic).toBe(true);
    expect(exportClassificationCsv(record.stats!).split('\n').length).toBeGreaterThan(1);
  });

  it('soft-fails LAZ with clear warning', () => {
    const laz = new File([new Uint8Array([1, 2, 3])], 'cloud.laz', { lastModified: 0 });
    const record = createLidarFileRecord(laz, new Uint8Array([1, 2, 3]));
    expect(record.isLaz).toBe(true);
    expect(record.points).toHaveLength(0);
    expect(record.warnings.some((w) => /LAZ/i.test(w))).toBe(true);
  });

  it('resolves suggestions', () => {
    const intro = resolveLidarSuggestion({
      hasFiles: false,
      hasError: false,
      isLaz: false
    });
    expect(intro?.path).toContain('contour-map-viewer');
  });
});
