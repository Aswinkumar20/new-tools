import { NIFTI_SAMPLE_BASE64 } from '../constants/nifti-viewer.constants';
import { base64ToUint8Array } from './medical-file.utils';
import { extractNiftiSlice, maxSliceIndex, parseNiftiBytes } from './nifti-parse.utils';
import { gzip } from 'pako';

describe('nifti-parse.utils', () => {
  const sampleBytes = base64ToUint8Array(NIFTI_SAMPLE_BASE64);

  it('parses sample brain volume dims and float32 data', () => {
    const parsed = parseNiftiBytes(sampleBytes);
    expect(parsed.dims).toEqual([16, 16, 8]);
    expect(parsed.header.datatypeLabel).toBe('float32');
    expect(parsed.data.length).toBe(16 * 16 * 8);
    expect(parsed.dataMax).toBeGreaterThan(parsed.dataMin);
    expect(parsed.compressedSource).toBe(false);
  });

  it('extracts axial / coronal / sagittal slices', () => {
    const parsed = parseNiftiBytes(sampleBytes);
    const axial = extractNiftiSlice(parsed, 'axial', 3);
    expect(axial.width).toBe(16);
    expect(axial.height).toBe(16);
    expect(axial.pixels.length).toBe(256);

    const coronal = extractNiftiSlice(parsed, 'coronal', 2);
    expect(coronal.width).toBe(16);
    expect(coronal.height).toBe(8);

    const sagittal = extractNiftiSlice(parsed, 'sagittal', 1);
    expect(sagittal.width).toBe(16);
    expect(sagittal.height).toBe(8);

    expect(maxSliceIndex(parsed, 'axial')).toBe(7);
  });

  it('gunzips .nii.gz payloads via pako', () => {
    const gz = gzip(sampleBytes);
    const parsed = parseNiftiBytes(gz);
    expect(parsed.compressedSource).toBe(true);
    expect(parsed.dims).toEqual([16, 16, 8]);
  });
});
