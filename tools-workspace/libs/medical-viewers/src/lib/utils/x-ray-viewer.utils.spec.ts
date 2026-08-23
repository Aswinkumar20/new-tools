import {
  createSampleXRayFile,
  enrichXRayFileRecord,
  modalityPreferenceWarning
} from './x-ray-viewer.utils';
import { createDicomFileRecord } from './dicom-viewer.utils';
import { readFileBytes } from './medical-file.utils';

describe('x-ray-viewer.utils', () => {
  it('warns on non-radiograph modality', () => {
    expect(modalityPreferenceWarning('DX')).toBeNull();
    expect(modalityPreferenceWarning('CR')).toBeNull();
    expect(modalityPreferenceWarning('MR')).toContain('preferred');
  });

  it('creates sample chest X-ray with lastModified 0', async () => {
    const sample = createSampleXRayFile();
    expect(sample.name).toBe('sample-chest-xray.dcm');
    expect(sample.lastModified).toBe(0);
    const bytes = await readFileBytes(sample);
    const record = enrichXRayFileRecord(createDicomFileRecord(sample, bytes));
    expect(record.parsed?.modality).toBe('DX');
    expect(record.parsed?.rows).toBe(32);
  });
});
