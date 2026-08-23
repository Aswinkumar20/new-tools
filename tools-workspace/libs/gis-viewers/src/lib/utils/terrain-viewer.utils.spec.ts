import {
  createSampleTerrainFile,
  filterValidTerrainFiles,
  formatTerrainFileSize,
  resolveTerrainSuggestion,
  suggestContourInterval,
  vizPresetToDisplay
} from './terrain-viewer.utils';
import { computeElevationStats, extractContours } from './dem-terrain.utils';

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
        putImageData: () => undefined,
        save: () => undefined,
        restore: () => undefined,
        beginPath: () => undefined,
        moveTo: () => undefined,
        lineTo: () => undefined,
        stroke: () => undefined
      };
    }
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: () => 'data:image/png;base64,AAAA'
  });
}

describe('terrain-viewer.utils', () => {
  beforeEach(() => {
    mockCanvas();
  });

  it('formats sizes and filters supported files', () => {
    expect(formatTerrainFileSize(1024)).toBe('1.0 KB');
    const ok = new File([new Uint8Array([1])], 'relief.tiff');
    const bad = new File(['x'], 'notes.csv');
    const result = filterValidTerrainFiles([ok, bad]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
  });

  it('creates sample with lastModified 0', () => {
    const sample = createSampleTerrainFile();
    expect(sample.name).toBe('sample-terrain.tif');
    expect(sample.lastModified).toBe(0);
  });

  it('maps viz presets and contour intervals', () => {
    expect(vizPresetToDisplay('contours').showContours).toBe(true);
    expect(vizPresetToDisplay('hillshade').displayMode).toBe('hillshade');
    const stats = computeElevationStats([0, 100]);
    const interval = suggestContourInterval(stats, 20);
    expect(interval).toBeGreaterThan(0);

    const elev = new Float64Array(16);
    for (let i = 0; i < 16; i++) elev[i] = i * 5;
    const contours = extractContours(elev, 4, 4, {
      interval: 20,
      bounds: { west: -1, south: -1, east: 1, north: 1 },
      maxLevels: 80
    });
    expect(contours.features.length).toBeGreaterThan(0);
  });

  it('resolves terrain suggestions', () => {
    const intro = resolveTerrainSuggestion({ hasFiles: false, hasError: false, hasBounds: false });
    expect(intro?.path).toContain('dem-viewer');
  });
});
