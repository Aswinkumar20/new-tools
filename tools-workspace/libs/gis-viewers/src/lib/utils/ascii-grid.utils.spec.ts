import { downsampleAsciiGrid, parseAsciiGrid } from './ascii-grid.utils';

const SAMPLE_ASC = `ncols         8
nrows         8
xllcorner     -122.45
yllcorner     37.75
cellsize      0.01
NODATA_value  -9999
10 12 14 16 18 20 22 24
11 13 15 17 19 21 23 25
12 14 16 30 32 22 24 26
13 15 40 45 42 25 26 27
14 16 38 50 48 28 29 30
15 17 20 22 24 26 28 32
16 18 19 21 23 25 27 29
17 19 20 22 24 26 28 30
`;

describe('ascii-grid.utils', () => {
  it('parses sample ASC header, values, and bounds', () => {
    const result = parseAsciiGrid(SAMPLE_ASC);
    expect(result.header.ncols).toBe(8);
    expect(result.header.nrows).toBe(8);
    expect(result.header.cellsize).toBe(0.01);
    expect(result.header.nodata).toBe(-9999);
    expect(result.header.xllcorner).toBe(-122.45);
    expect(result.header.yllcorner).toBe(37.75);
    expect(result.values.length).toBe(64);
    expect(result.values[0]).toBe(10);
    expect(result.values[63]).toBe(30);
    expect(result.bounds).toEqual({
      west: -122.45,
      south: 37.75,
      east: -122.37,
      north: 37.83
    });
    expect(result.warnings).toEqual([]);
  });

  it('rejects empty or incomplete grids', () => {
    expect(() => parseAsciiGrid('')).toThrow(/empty/i);
    expect(() =>
      parseAsciiGrid('ncols 2\nnrows 2\ncellsize 1\n1 2\n')
    ).toThrow(/Expected 4/);
  });

  it('downsamples large grids', () => {
    const values = new Float64Array(16);
    for (let i = 0; i < 16; i++) values[i] = i;
    const out = downsampleAsciiGrid(values, 4, 4, 2);
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect(out.downsampled).toBe(true);
    expect(out.values.length).toBe(4);
  });
});
