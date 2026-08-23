import {
  buildMeasureResult,
  createSampleCtFile,
  distanceMm,
  distancePx,
  enrichCtFileRecord,
  modalityPreferenceWarning
} from './ct-scan-viewer.utils';
import { createDicomFileRecord } from './dicom-viewer.utils';
import { readFileBytes } from './medical-file.utils';

describe('ct-scan-viewer.utils', () => {
  it('warns on non-CT modality', () => {
    expect(modalityPreferenceWarning('CT')).toBeNull();
    expect(modalityPreferenceWarning('MR')).toContain('preferred: CT');
  });

  it('creates sample chest CT with lastModified 0', async () => {
    const sample = createSampleCtFile();
    expect(sample.name).toBe('sample-chest-ct.dcm');
    expect(sample.lastModified).toBe(0);
    const bytes = await readFileBytes(sample);
    const record = enrichCtFileRecord(createDicomFileRecord(sample, bytes));
    expect(record.parsed?.modality).toBe('CT');
    expect(record.parsed?.rows).toBe(32);
  });

  it('computes measure distance in px and mm', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 3, y: 4 };
    expect(distancePx(a, b)).toBe(5);
    expect(distanceMm(a, b, null)).toBeNull();
    expect(distanceMm(a, b, [2, 2])).toBeCloseTo(10, 5);
    const anisotropic = distanceMm(a, b, [1, 2]);
    expect(anisotropic).toBeCloseTo(Math.hypot(3 * 2, 4 * 1), 5);
    const result = buildMeasureResult(a, b, [1, 1]);
    expect(result.distancePx).toBe(5);
    expect(result.distanceMm).toBeCloseTo(5, 5);
  });
});
