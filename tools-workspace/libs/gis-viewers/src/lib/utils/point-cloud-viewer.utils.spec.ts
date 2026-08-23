import {
  createPointCloudFileRecord,
  createSamplePointCloudFile,
  exportXyzCsv,
  filterValidPointCloudFiles,
  parseAsciiPcd,
  parseAsciiPly,
  readPointCloudFileBytes,
  resolvePointCloudSuggestion
} from './point-cloud-viewer.utils';

describe('point-cloud-viewer.utils', () => {
  it('creates sample PLY with lastModified 0 and parses vertices', async () => {
    const sample = createSamplePointCloudFile();
    expect(sample.name).toBe('sample-cloud.ply');
    expect(sample.lastModified).toBe(0);
    const bytes = await readPointCloudFileBytes(sample);
    const record = createPointCloudFileRecord(sample, bytes);
    expect(record.softFail).toBe(false);
    expect(record.points.length).toBe(256);
    expect(record.stats?.hasRgb).toBe(true);
    expect(record.stats?.hasIntensity).toBe(true);
    expect(exportXyzCsv(record.points, 10).split('\n').length).toBe(11);
  });

  it('parses ASCII PCD and soft-fails LAZ/E57', () => {
    const pcd = `VERSION .7
FIELDS x y z intensity
SIZE 4 4 4 4
TYPE F F F F
COUNT 1 1 1 1
WIDTH 2
HEIGHT 1
POINTS 2
DATA ascii
0 0 0 10
1 1 1 20
`;
    const parsed = parseAsciiPcd(pcd);
    expect(parsed.points).toHaveLength(2);
    const laz = new File([new Uint8Array([1, 2, 3])], 'cloud.laz', { lastModified: 0 });
    const lazRecord = createPointCloudFileRecord(laz, new Uint8Array([1, 2, 3]));
    expect(lazRecord.softFail).toBe(true);
    expect(lazRecord.warnings.some((w) => /LAZ/i.test(w))).toBe(true);
    const e57 = new File([new Uint8Array([1])], 'scan.e57', { lastModified: 0 });
    const e57Record = createPointCloudFileRecord(e57, new Uint8Array([1]));
    expect(e57Record.softFail).toBe(true);
  });

  it('filters unsupported files and resolves suggestions', () => {
    const ply = new File([new Uint8Array([1])], 'a.ply', { lastModified: 0 });
    const bad = new File([new Uint8Array([1])], 'b.txt', { lastModified: 0 });
    const result = filterValidPointCloudFiles([ply, bad]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.length).toBeGreaterThanOrEqual(1);
    expect(resolvePointCloudSuggestion({ hasFiles: false, hasError: false, softFail: false })?.id).toBe(
      'point-cloud-intro'
    );
  });

  it('rejects binary PLY formats clearly', () => {
    expect(() =>
      parseAsciiPly(`ply
format binary_little_endian 1.0
element vertex 1
property float x
property float y
property float z
end_header
`)
    ).toThrow(/ASCII PLY/i);
  });
});
