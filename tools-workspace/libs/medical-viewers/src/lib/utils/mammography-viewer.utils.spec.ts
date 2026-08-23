import {
  buildMammographyHanging,
  createSampleMammographyFile,
  enrichMammographyFileRecord,
  hangingAssignedCount,
  inferMammographySlot,
  modalityPreferenceWarning
} from './mammography-viewer.utils';
import { createDicomFileRecord } from './dicom-viewer.utils';
import { readFileBytes } from './medical-file.utils';

describe('mammography-viewer.utils', () => {
  it('warns on non-MG modality', () => {
    expect(modalityPreferenceWarning('MG')).toBeNull();
    expect(modalityPreferenceWarning('DX')).toContain('preferred: MG');
  });

  it('creates sample MG with lastModified 0', async () => {
    const sample = createSampleMammographyFile();
    expect(sample.name).toBe('sample-mg-screening.dcm');
    expect(sample.lastModified).toBe(0);
    const bytes = await readFileBytes(sample);
    const record = enrichMammographyFileRecord(createDicomFileRecord(sample, bytes));
    expect(record.parsed?.modality).toBe('MG');
    expect(record.parsed?.rows).toBe(32);
  });

  it('builds hanging layout slots', async () => {
    const sample = createSampleMammographyFile();
    const bytes = await readFileBytes(sample);
    const record = enrichMammographyFileRecord(createDicomFileRecord(sample, bytes));
    const parsed = record.parsed!;
    expect(inferMammographySlot({ ...parsed, imageLaterality: 'R', viewPosition: 'CC' })).toBe('R-CC');
    expect(inferMammographySlot({ ...parsed, imageLaterality: 'L', viewPosition: 'MLO' })).toBe('L-MLO');
    const cells = buildMammographyHanging([record]);
    expect(cells.length).toBe(4);
    expect(hangingAssignedCount(cells)).toBe(0);

    const rcc = { ...record, parsed: { ...parsed, imageLaterality: 'R', viewPosition: 'CC' } };
    const lmlo = { ...record, id: 'file-lmlo', parsed: { ...parsed, imageLaterality: 'L', viewPosition: 'MLO' } };
    const assigned = buildMammographyHanging([rcc, lmlo]);
    expect(assigned.find((c) => c.slot === 'R-CC')?.file).toBe(rcc);
    expect(assigned.find((c) => c.slot === 'L-MLO')?.file).toBe(lmlo);
    expect(hangingAssignedCount(assigned)).toBe(2);
  });
});
