import {
  createSampleUltrasoundFile,
  enrichUltrasoundFileRecord,
  getCineDisplayPixels,
  modalityPreferenceWarning,
  resolveCineFrameCount,
  resolveUltrasoundCineMode
} from './ultrasound-viewer.utils';
import { createDicomFileRecord } from './dicom-viewer.utils';
import { readFileBytes } from './medical-file.utils';

describe('ultrasound-viewer.utils', () => {
  it('warns on non-US modality', () => {
    expect(modalityPreferenceWarning('US')).toBeNull();
    expect(modalityPreferenceWarning('CT')).toContain('preferred: US');
  });

  it('creates sample US with lastModified 0', async () => {
    const sample = createSampleUltrasoundFile();
    expect(sample.name).toBe('sample-abdominal-us.dcm');
    expect(sample.lastModified).toBe(0);
    const bytes = await readFileBytes(sample);
    const record = enrichUltrasoundFileRecord(createDicomFileRecord(sample, bytes));
    expect(record.parsed?.modality).toBe('US');
    expect(record.parsed?.rows).toBe(32);
  });

  it('resolves cine mode and frame pixels', async () => {
    const sample = createSampleUltrasoundFile();
    const bytes = await readFileBytes(sample);
    const record = enrichUltrasoundFileRecord(createDicomFileRecord(sample, bytes));
    const parsed = record.parsed!;
    expect(resolveUltrasoundCineMode(parsed, 1)).toBe('single');
    expect(resolveCineFrameCount('single', parsed, 1)).toBe(1);
    const pixels = getCineDisplayPixels('single', 0, parsed, [record]);
    expect(pixels.length).toBe(32 * 32);
  });
});
