import {
  createSampleCogFile,
  filterValidCogFiles,
  formatCogFileSize,
  openAndParseCog,
  readCogFileBytes,
  resolveCogSuggestion,
  centerWindow
} from './cog-viewer.utils';
import { COG_SAMPLE_BASE64 } from '../constants/cog-viewer.constants';

function mockCanvas(): void {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: function getContext() {
      return {
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h
        }),
        putImageData: () => undefined
      };
    }
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: () => 'data:image/png;base64,AAAA'
  });
}

describe('cog-viewer.utils', () => {
  beforeEach(() => {
    mockCanvas();
  });

  it('formats sizes and filters supported files', () => {
    expect(formatCogFileSize(1500)).toBe('1.5 KB');
    const ok = new File([new Uint8Array([1])], 'a.tiff');
    const bad = new File(['x'], 'a.json');
    const result = filterValidCogFiles([ok, bad]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected[0].name).toBe('a.json');
  });

  it('creates sample COG-named file with lastModified 0', () => {
    expect(COG_SAMPLE_BASE64.length).toBeGreaterThan(100);
    const sample = createSampleCogFile();
    expect(sample.name).toBe('sample-city-cog.tif');
    expect(sample.lastModified).toBe(0);
  });

  it('parses sample and reports soft COG gaps', async () => {
    const sample = createSampleCogFile();
    const bytes = await readCogFileBytes(sample);
    const parsed = await openAndParseCog(bytes, sample.name, { isSample: true });
    expect(parsed.metadata.width).toBe(64);
    expect(parsed.warnings.some((w) => /not fully|strip|overview|sample/i.test(w))).toBe(true);
    expect(centerWindow(200, 200, 100)).toEqual([50, 50, 150, 150]);
  });

  it('resolves suggestions by state', () => {
    expect(
      resolveCogSuggestion({
        hasFiles: false,
        hasError: false,
        softCompliant: null
      })?.id
    ).toBe('cog-intro');
    expect(
      resolveCogSuggestion({
        hasFiles: true,
        hasError: false,
        softCompliant: false
      })?.id
    ).toBe('cog-soft');
  });
});
