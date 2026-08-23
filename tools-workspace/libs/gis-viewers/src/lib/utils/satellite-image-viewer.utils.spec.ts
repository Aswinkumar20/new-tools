import {
  canUseNdvi,
  colormapRgb,
  createSampleSatelliteFile,
  filterValidSatelliteFiles,
  resolveCompositeBands,
  resolveSatelliteSuggestion
} from './satellite-image-viewer.utils';

describe('satellite-image-viewer.utils', () => {
  it('creates sample EO tif with lastModified 0', () => {
    const sample = createSampleSatelliteFile();
    expect(sample.name).toBe('sample-eo.tif');
    expect(sample.lastModified).toBe(0);
  });

  it('resolves composite presets and NDVI gating', () => {
    expect(resolveCompositeBands('true-color', 3, { red: 0, green: 1, blue: 2, grayscale: false })).toEqual({
      red: 0,
      green: 1,
      blue: 2,
      grayscale: false
    });
    expect(resolveCompositeBands('false-color-ir', 4, { red: 0, green: 1, blue: 2, grayscale: false })).toEqual({
      red: 3,
      green: 0,
      blue: 1,
      grayscale: false
    });
    expect(canUseNdvi(3)).toBe(false);
    expect(canUseNdvi(4)).toBe(true);
    const [r, g, b] = colormapRgb(0.5, 'viridis');
    expect(r).toBeGreaterThanOrEqual(0);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
  });

  it('filters files and resolves suggestions', () => {
    const ok = new File([new Uint8Array([1])], 'a.tif', { lastModified: 0 });
    const bad = new File([new Uint8Array([1])], 'b.png', { lastModified: 0 });
    const result = filterValidSatelliteFiles([ok, bad]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(
      resolveSatelliteSuggestion({
        hasFiles: false,
        hasError: false,
        hasBounds: false,
        bandCount: 0
      })?.id
    ).toBe('satellite-intro');
  });
});
