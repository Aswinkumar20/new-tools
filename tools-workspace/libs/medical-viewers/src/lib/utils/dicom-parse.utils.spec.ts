import { DICOM_SAMPLE_BASE64 } from '../constants/dicom-viewer.constants';
import { base64ToUint8Array } from './medical-file.utils';
import { hasDicomMagic, parseDicomBytes } from './dicom-parse.utils';

describe('dicom-parse.utils', () => {
  const sampleBytes = base64ToUint8Array(DICOM_SAMPLE_BASE64);

  it('detects DICM preamble on the sample', () => {
    expect(hasDicomMagic(sampleBytes)).toBe(true);
  });

  it('parses sample scout geometry and pixels', () => {
    const parsed = parseDicomBytes(sampleBytes);
    expect(parsed.rows).toBe(32);
    expect(parsed.columns).toBe(32);
    expect(parsed.bitsAllocated).toBe(16);
    expect(parsed.photometricInterpretation).toBe('MONOCHROME2');
    expect(parsed.patientName).toContain('Sample');
    expect(parsed.modality).toBe('OT');
    expect(parsed.pixels.length).toBe(32 * 32);
    expect(parsed.compressed).toBe(false);
    expect(parsed.windowCenter).toBe(1000);
    expect(parsed.windowWidth).toBe(2000);
    expect(parsed.metadataRows.length).toBeGreaterThan(5);
  });

  it('rejects empty buffers', () => {
    expect(() => parseDicomBytes(new Uint8Array(0))).toThrow(/Empty/);
  });
});
