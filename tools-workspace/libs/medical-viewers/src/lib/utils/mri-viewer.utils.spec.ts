import {
  createSampleMriFile,
  enrichMriFileRecord,
  modalityPreferenceWarning
} from './mri-viewer.utils';
import { createDicomFileRecord } from './dicom-viewer.utils';
import { groupBySeries, sortSlices } from './dicom-series.utils';
import { readFileBytes } from './medical-file.utils';
import type { DicomLoadedFile } from '../types/dicom-viewer.types';

function stubFile(
  name: string,
  seriesUid: string,
  instance: number | null,
  z?: number
): DicomLoadedFile {
  return {
    id: name,
    name,
    size: 1,
    extension: '.dcm',
    bytes: new Uint8Array([1]),
    softFail: false,
    warnings: [],
    parsed: {
      rows: 2,
      columns: 2,
      bitsAllocated: 16,
      bitsStored: 16,
      highBit: 15,
      pixelRepresentation: 0,
      samplesPerPixel: 1,
      photometricInterpretation: 'MONOCHROME2',
      rescaleSlope: 1,
      rescaleIntercept: 0,
      windowCenter: null,
      windowWidth: null,
      numberOfFrames: 1,
      transferSyntaxUid: '1.2.840.10008.1.2.1',
      patientName: '',
      patientId: '',
      modality: 'MR',
      studyInstanceUid: '1',
      seriesInstanceUid: seriesUid,
      sopInstanceUid: name,
      instanceNumber: instance,
      pixelSpacing: null,
      imagePositionPatient: z != null ? [0, 0, z] : null,
      seriesDescription: seriesUid === 'A' ? 'Brain T1' : '',
      protocolName: '',
      pixels: new Float32Array(4),
      metadataRows: [],
      warnings: [],
      compressed: false
    }
  };
}

describe('mri-viewer.utils', () => {
  it('warns on non-MR modality but allows empty', () => {
    expect(modalityPreferenceWarning('MR')).toBeNull();
    expect(modalityPreferenceWarning('CT')).toContain('preferred: MR');
    expect(modalityPreferenceWarning('')).toContain('missing');
  });

  it('creates sample brain MR with lastModified 0', async () => {
    const sample = createSampleMriFile();
    expect(sample.name).toBe('sample-brain-mr.dcm');
    expect(sample.lastModified).toBe(0);
    const bytes = await readFileBytes(sample);
    const record = enrichMriFileRecord(createDicomFileRecord(sample, bytes));
    expect(record.parsed?.modality).toBe('MR');
    expect(record.parsed?.rows).toBe(32);
    expect(record.warnings.some((w) => w.includes('preferred'))).toBe(false);
  });

  it('groups by series and sorts by instance / IPP', () => {
    const files = [
      stubFile('c.dcm', 'B', 2, 20),
      stubFile('a.dcm', 'A', 3, 30),
      stubFile('b.dcm', 'A', 1, 10)
    ];
    const groups = groupBySeries(files);
    expect(groups.length).toBe(2);
    const seriesA = groups.find((g) => g.seriesInstanceUid === 'A');
    expect(seriesA?.files.map((f) => f.name)).toEqual(['b.dcm', 'a.dcm']);
    expect(seriesA?.description).toBe('Brain T1');
    const byZ = sortSlices([stubFile('z2.dcm', 'X', null, 5), stubFile('z1.dcm', 'X', null, 1)]);
    expect(byZ.map((f) => f.name)).toEqual(['z1.dcm', 'z2.dcm']);
  });
});
