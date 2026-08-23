import {
  createSamplePetScanFile,
  enrichPetScanFileRecord,
  modalityPreferenceWarning,
  petActivityValue,
  resolvePetFusionPair
} from './pet-scan-viewer.utils';
import { createDicomFileRecord } from './dicom-viewer.utils';
import { readFileBytes } from './medical-file.utils';

describe('pet-scan-viewer.utils', () => {
  it('warns on non-PT modality', () => {
    expect(modalityPreferenceWarning('PT')).toBeNull();
    expect(modalityPreferenceWarning('CT')).toContain('preferred: PT');
  });

  it('creates sample PT with lastModified 0', async () => {
    const sample = createSamplePetScanFile();
    expect(sample.name).toBe('sample-fdg-pet.dcm');
    expect(sample.lastModified).toBe(0);
    const bytes = await readFileBytes(sample);
    const record = enrichPetScanFileRecord(createDicomFileRecord(sample, bytes));
    expect(record.parsed?.modality).toBe('PT');
    expect(record.parsed?.rows).toBe(32);
  });

  it('computes PET activity and fusion pair', async () => {
    const sample = createSamplePetScanFile();
    const bytes = await readFileBytes(sample);
    const pt = enrichPetScanFileRecord(createDicomFileRecord(sample, bytes));
    const parsed = pt.parsed!;
    expect(petActivityValue(parsed, 100)).toBeCloseTo(100 * parsed.rescaleSlope + parsed.rescaleIntercept, 5);

    const ctFile = {
      ...pt,
      id: 'ct-1',
      name: 'ct.dcm',
      parsed: parsed ? { ...parsed, modality: 'CT', seriesInstanceUid: 'ct-series' } : null
    };
    const ptFile = {
      ...pt,
      parsed: parsed ? { ...parsed, modality: 'PT', seriesInstanceUid: 'pt-series' } : null
    };
    const groups = [
      { seriesInstanceUid: 'pt-series', label: 'PET (1)', description: '', protocolName: '', files: [ptFile] },
      { seriesInstanceUid: 'ct-series', label: 'CT (1)', description: '', protocolName: '', files: [ctFile] }
    ];
    const fusion = resolvePetFusionPair(groups);
    expect(fusion?.ptLabel).toContain('PET');
    expect(fusion?.anatomyLabel).toContain('CT');
  });
});
