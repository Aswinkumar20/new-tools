import { RASTER_MAP_SAMPLE_ASC } from '../constants/raster-map-viewer.constants';
import { parseAsciiGrid } from './ascii-grid.utils';
import {
  createSampleRasterMapFile,
  filterValidRasterMapFiles,
  rasterLegendGradientCss,
  resolveRasterMapSuggestion
} from './raster-map-viewer.utils';

describe('raster-map-viewer.utils', () => {
  it('accepts geotiff and asc', () => {
    const { accepted, rejected } = filterValidRasterMapFiles([
      new File(['x'], 'a.tif'),
      new File([RASTER_MAP_SAMPLE_ASC], 'b.asc'),
      new File(['x'], 'c.png')
    ]);
    expect(accepted.map((f) => f.name)).toEqual(['a.tif', 'b.asc']);
    expect(rejected).toHaveLength(1);
  });

  it('creates sample ASC with lastModified 0', () => {
    const sample = createSampleRasterMapFile();
    expect(sample.name).toBe('sample-raster.asc');
    expect(sample.lastModified).toBe(0);
  });

  it('parses sample ASC header and value range via ascii-grid', () => {
    const parsed = parseAsciiGrid(RASTER_MAP_SAMPLE_ASC);
    expect(parsed.header.ncols).toBe(8);
    expect(parsed.header.nrows).toBe(8);
    expect(parsed.header.cellsize).toBe(0.01);
    expect(parsed.bounds?.west).toBeCloseTo(-122.45);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < parsed.values.length; i++) {
      const v = parsed.values[i];
      if (v === parsed.header.nodata) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(min).toBe(10);
    expect(max).toBe(50);
  });

  it('builds legend CSS for turbo and viridis', () => {
    expect(rasterLegendGradientCss('turbo')).toContain('linear-gradient');
    expect(rasterLegendGradientCss('viridis')).toContain('linear-gradient');
  });

  it('resolves intro suggestion', () => {
    expect(
      resolveRasterMapSuggestion({ hasFiles: false, hasError: false, hasBounds: false })?.id
    ).toBe('raster-map-intro');
  });
});
