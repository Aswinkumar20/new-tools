import {
  createSampleContourFile,
  elevationFromProperties,
  filterValidContourFiles,
  formatContourFileSize,
  isMajorContourLevel,
  parseContourGeoJson,
  pickContourLabels,
  resolveContourSuggestion,
  suggestContourInterval,
  uniqueContourLevels
} from './contour-map-viewer.utils';
import { computeElevationStats } from './dem-terrain.utils';

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
        drawImage: () => undefined,
        clearRect: () => undefined,
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

describe('contour-map-viewer.utils', () => {
  beforeEach(() => {
    mockCanvas();
  });

  it('formats sizes and filters supported files including duplicates', () => {
    expect(formatContourFileSize(2048)).toBe('2.0 KB');
    const dem = new File([new Uint8Array([1])], 'hill.tif', { lastModified: 0 });
    const geo = new File(['{}'], 'lines.geojson', { lastModified: 0 });
    const bad = new File(['x'], 'notes.csv', { lastModified: 0 });
    const dup = new File([new Uint8Array([1])], 'hill.tif', { lastModified: 0 });
    const result = filterValidContourFiles([dem, geo, bad, dup]);
    expect(result.accepted).toHaveLength(2);
    expect(result.rejected.length).toBeGreaterThanOrEqual(2);
  });

  it('creates sample with lastModified 0', () => {
    const sample = createSampleContourFile();
    expect(sample.name).toBe('sample-contours.tif');
    expect(sample.lastModified).toBe(0);
  });

  it('parses contour geojson and samples labels', () => {
    const text = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { elev: 100 },
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1, 1]
            ]
          }
        },
        {
          type: 'Feature',
          properties: { elevation: 120 },
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 1],
              [1, 0]
            ]
          }
        }
      ]
    });
    const parsed = parseContourGeoJson(text);
    expect(parsed.hasElevationProps).toBe(true);
    expect(parsed.contours.features).toHaveLength(2);
    expect(elevationFromProperties(parsed.contours.features[0].properties)).toBe(100);
    const levels = uniqueContourLevels(parsed.contours);
    expect(levels).toEqual([100, 120]);
    expect(isMajorContourLevel(100, 20, 5, levels)).toBe(true);
    const labels = pickContourLabels(parsed.contours, { interval: 20, majorEvery: 5, maxLabels: 40 });
    expect(labels.length).toBe(2);
  });

  it('suggests contour interval and resolves suggestions', () => {
    const stats = computeElevationStats([0, 100, 200]);
    expect(suggestContourInterval(stats, 20)).toBeGreaterThan(0);
    const intro = resolveContourSuggestion({ hasFiles: false, hasError: false, hasBounds: false });
    expect(intro?.path).toContain('dem-viewer');
  });

  it('warns when geojson has no elevation properties', () => {
    const text = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [10, 10],
              [11, 11]
            ]
          }
        }
      ]
    });
    const parsed = parseContourGeoJson(text);
    expect(parsed.hasElevationProps).toBe(false);
  });
});
