import {
  createSampleDemFile,
  filterValidDemFiles,
  formatDemFileSize,
  resolveDemSuggestion
} from './dem-viewer.utils';
import { computeElevationStats, colormapRgb, computeHillshade } from './dem-terrain.utils';

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

describe('dem-viewer.utils', () => {
  beforeEach(() => {
    mockCanvas();
  });

  it('formats sizes and filters supported files', () => {
    expect(formatDemFileSize(500)).toBe('500 B');
    expect(formatDemFileSize(2048)).toBe('2.0 KB');

    const ok = new File([new Uint8Array([1, 2, 3])], 'hill.tif');
    const bad = new File(['x'], 'notes.txt', { type: 'text/plain' });
    const result = filterValidDemFiles([ok, bad]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected[0].name).toBe('notes.txt');
  });

  it('creates sample with lastModified 0', () => {
    const sample = createSampleDemFile();
    expect(sample.name).toBe('sample-hill.tif');
    expect(sample.lastModified).toBe(0);
    expect(sample.size).toBeGreaterThan(0);
  });

  it('resolves suggestions for empty and error states', () => {
    const intro = resolveDemSuggestion({ hasFiles: false, hasError: false, hasBounds: false });
    expect(intro?.path).toContain('terrain-viewer');
    const err = resolveDemSuggestion({ hasFiles: false, hasError: true, hasBounds: false });
    expect(err?.id).toBe('dem-error');
  });

  it('shares elevation helpers for hillshade and colormap', () => {
    const elev = new Float64Array([1, 2, 3, 4]);
    const stats = computeElevationStats(elev);
    expect(stats.range).toBe(3);
    const rgb = colormapRgb('hypsometric', 0.5);
    expect(rgb.every((n) => n >= 0 && n <= 255)).toBe(true);
    const shade = computeHillshade(elev, 2, 2);
    expect(shade.length).toBe(4);
  });
});
