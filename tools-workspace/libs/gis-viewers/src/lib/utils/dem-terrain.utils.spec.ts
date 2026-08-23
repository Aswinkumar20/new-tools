import {
  colormapRgb,
  computeElevationStats,
  computeHillshade,
  extractContours,
  sampleElevationAtLatLng,
  suggestContourInterval
} from './dem-terrain.utils';

describe('dem-terrain.utils', () => {
  it('computes elevation stats ignoring nodata', () => {
    const values = [1, 2, 3, -9999, 4];
    const stats = computeElevationStats(values, -9999);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(4);
    expect(stats.mean).toBe(2.5);
    expect(stats.range).toBe(3);
    expect(stats.validCount).toBe(4);
  });

  it('returns RGB from colormaps', () => {
    const gray = colormapRgb('grayscale', 0.5);
    expect(gray[0]).toBe(gray[1]);
    expect(gray[1]).toBe(gray[2]);
    const terrain = colormapRgb('terrain', 0);
    expect(terrain.length).toBe(3);
    const viridis = colormapRgb('viridis', 1);
    expect(viridis[0]).toBeGreaterThan(200);
  });

  it('produces hillshade values in [0, 1]', () => {
    const width = 5;
    const height = 5;
    const elev = new Float64Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        elev[y * width + x] = x + y;
      }
    }
    const shade = computeHillshade(elev, width, height, {
      azimuth: 315,
      altitude: 45,
      zFactor: 1
    });
    expect(shade.length).toBe(25);
    let sum = 0;
    for (let i = 0; i < shade.length; i++) {
      expect(shade[i]).toBeGreaterThanOrEqual(0);
      expect(shade[i]).toBeLessThanOrEqual(1);
      sum += shade[i];
    }
    expect(sum).toBeGreaterThan(0);
  });

  it('suggests contour intervals and extracts contours', () => {
    const stats = computeElevationStats([0, 10, 20, 30, 40, 50]);
    const interval = suggestContourInterval(stats, 10);
    expect(interval).toBeGreaterThan(0);

    const width = 4;
    const height = 4;
    const elev = new Float64Array(width * height);
    for (let i = 0; i < elev.length; i++) {
      elev[i] = i * 2;
    }
    const contours = extractContours(elev, width, height, {
      interval: 10,
      bounds: { west: 0, south: 0, east: 1, north: 1 },
      maxLevels: 80,
      stats: computeElevationStats(elev)
    });
    expect(contours.type).toBe('FeatureCollection');
    expect(contours.features.length).toBeGreaterThan(0);
    expect(contours.features[0].geometry?.type).toBe('LineString');
  });

  it('samples elevation with bilinear interpolation', () => {
    const elev = new Float64Array([0, 10, 20, 30]);
    const value = sampleElevationAtLatLng(
      elev,
      2,
      2,
      { west: 0, south: 0, east: 10, north: 10 },
      5,
      5,
      null
    );
    expect(value).not.toBeNull();
    expect(value!).toBeCloseTo(15, 5);
  });
});
