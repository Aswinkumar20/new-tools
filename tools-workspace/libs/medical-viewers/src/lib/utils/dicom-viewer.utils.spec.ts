import {
  createSampleDicomFile,
  filterValidDicomFiles,
  createDicomFileRecord,
  defaultWindowForParsed,
  probeDicomPixel
} from './dicom-viewer.utils';
import { readFileBytes } from './medical-file.utils';
import { applyWindowLevelToByte, computeZoomFit, rotatePixels90Clockwise } from './medical-image-render.utils';

describe('dicom-viewer.utils', () => {
  it('filters empty, unsupported, and duplicate files', () => {
    const ok = new File([new Uint8Array([1, 2, 3])], 'a.dcm', { lastModified: 0 });
    const empty = new File([], 'empty.dcm', { lastModified: 0 });
    const bad = new File([new Uint8Array([1])], 'notes.txt', { lastModified: 0 });
    const dup = new File([new Uint8Array([1, 2, 3])], 'a.dcm', { lastModified: 0 });
    const { accepted, rejected } = filterValidDicomFiles([ok, empty, bad, dup]);
    expect(accepted).toHaveLength(1);
    expect(rejected.length).toBeGreaterThanOrEqual(3);
  });

  it('creates sample scout with lastModified 0 and parses it', async () => {
    const sample = createSampleDicomFile();
    expect(sample.name).toBe('sample-scout.dcm');
    expect(sample.lastModified).toBe(0);
    const bytes = await readFileBytes(sample);
    const record = createDicomFileRecord(sample, bytes);
    expect(record.parsed?.rows).toBe(32);
    expect(record.softFail).toBe(false);
    const win = defaultWindowForParsed(record.parsed!);
    expect(win.width).toBeGreaterThan(0);
    const probe = probeDicomPixel(record.parsed!, 1, 1);
    expect(probe).not.toBeNull();
  });
});

describe('medical-image-render.utils', () => {
  it('windows values and fits zoom', () => {
    expect(applyWindowLevelToByte(0, 0, 100, false)).toBe(128);
    expect(applyWindowLevelToByte(0, 0, 100, true)).toBe(127);
    expect(computeZoomFit(200, 200, 100, 100)).toBeCloseTo(1.68, 1);
    const rotated = rotatePixels90Clockwise([1, 2, 3, 4], 2, 2);
    expect(rotated.width).toBe(2);
    expect(rotated.height).toBe(2);
    expect(Array.from(rotated.pixels)).toEqual([3, 1, 4, 2]);
  });
});
