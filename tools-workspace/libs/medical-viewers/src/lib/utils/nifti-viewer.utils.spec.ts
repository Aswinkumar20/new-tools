import {
  createSampleNiftiFile,
  filterValidNiftiFiles,
  createNiftiFileRecord,
  defaultWindowForVolume
} from './nifti-viewer.utils';
import { readFileBytes } from './medical-file.utils';

describe('nifti-viewer.utils', () => {
  it('filters empty, unsupported, and duplicate files', () => {
    const ok = new File([new Uint8Array([1, 2, 3])], 'a.nii', { lastModified: 0 });
    const gz = new File([new Uint8Array([1, 2])], 'b.nii.gz', { lastModified: 0 });
    const empty = new File([], 'empty.nii', { lastModified: 0 });
    const bad = new File([new Uint8Array([1])], 'notes.txt', { lastModified: 0 });
    const dup = new File([new Uint8Array([1, 2, 3])], 'a.nii', { lastModified: 0 });
    const { accepted, rejected } = filterValidNiftiFiles([ok, gz, empty, bad, dup]);
    expect(accepted).toHaveLength(2);
    expect(rejected.length).toBeGreaterThanOrEqual(2);
  });

  it('creates sample brain with lastModified 0 and parses it', async () => {
    const sample = createSampleNiftiFile();
    expect(sample.name).toBe('sample-brain.nii');
    expect(sample.lastModified).toBe(0);
    const bytes = await readFileBytes(sample);
    const record = createNiftiFileRecord(sample, bytes);
    expect(record.parsed?.dims).toEqual([16, 16, 8]);
    expect(record.softFail).toBe(false);
    const win = defaultWindowForVolume(record.parsed!);
    expect(win.width).toBeGreaterThan(0);
  });
});
