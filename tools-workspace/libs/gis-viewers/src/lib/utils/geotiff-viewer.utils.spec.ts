import {
  computePreviewSize,
  stretchValues,
  scaleToByte,
  analyzeCogCompliance,
  buildGeotiffWarnings,
  centerWindow,
  defaultBandSelection
} from './geotiff-raster.utils';
import type { GeotiffRasterMetadata } from '../types/geotiff-viewer.types';
import {
  createSampleGeotiffFile,
  filterValidGeotiffFiles,
  formatGeotiffFileSize,
  resolveGeotiffSuggestion,
  openAndParseGeotiff,
  readGeotiffFileBytes
} from './geotiff-viewer.utils';
import { GEOTIFF_SAMPLE_BASE64 } from '../constants/geotiff-viewer.constants';

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

describe('geotiff-viewer.utils', () => {
  beforeEach(() => {
    mockCanvas();
  });

  it('formats sizes and filters supported files', () => {
    expect(formatGeotiffFileSize(500)).toBe('500 B');
    expect(formatGeotiffFileSize(2048)).toBe('2.0 KB');

    const ok = new File([new Uint8Array([1, 2, 3])], 'demo.tif');
    const bad = new File(['x'], 'demo.txt', { type: 'text/plain' });
    const result = filterValidGeotiffFiles([ok, bad]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected[0].name).toBe('demo.txt');
  });

  it('computes preview downsample and stretch ranges', () => {
    expect(computePreviewSize(64, 64, 1024)).toEqual({
      width: 64,
      height: 64,
      downsampled: false
    });
    const big = computePreviewSize(4096, 2048, 1024);
    expect(big.width).toBe(1024);
    expect(big.height).toBe(512);
    expect(big.downsampled).toBe(true);

    const values = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const minmax = stretchValues(values, 'minmax');
    expect(minmax.min).toBe(0);
    expect(minmax.max).toBe(100);
    const pct = stretchValues(values, 'percentile');
    expect(pct.min).toBeLessThan(pct.max);
    expect(scaleToByte(50, 0, 100)).toBe(128);
  });

  it('builds default bands and center windows', () => {
    expect(defaultBandSelection(1).grayscale).toBe(true);
    expect(defaultBandSelection(3)).toEqual({
      red: 0,
      green: 1,
      blue: 2,
      grayscale: false
    });
    expect(centerWindow(1000, 800, 256)).toEqual([372, 272, 628, 528]);
  });

  it('analyzes COG compliance and soft warnings', () => {
    const metadata: GeotiffRasterMetadata = {
      width: 64,
      height: 64,
      samplesPerPixel: 3,
      bitsPerSample: 8,
      photometric: 2,
      photometricLabel: 'RGB',
      geoKeys: { GTModelTypeGeoKey: 2, GeographicTypeGeoKey: 4326 },
      origin: [-122.45, 37.8, 0],
      resolution: [0.001, -0.001, 0],
      bbox: [-122.45, 37.736, -122.386, 37.8],
      nodata: null,
      tiled: false,
      tileWidth: null,
      tileHeight: null,
      compression: 1,
      compressionLabel: 'Uncompressed',
      imageCount: 1,
      overviews: [{ index: 0, width: 64, height: 64 }],
      gdalMetadata: {},
      crsNote: 'Geographic CRS (EPSG:4326 WGS84)'
    };
    const cog = analyzeCogCompliance(metadata);
    expect(cog.isTiled).toBe(false);
    expect(cog.hasOverviews).toBe(false);
    expect(cog.softCompliant).toBe(false);
    expect(cog.checklist.some((c) => c.id === 'tiled' && c.status === 'fail')).toBe(true);

    const warnings = buildGeotiffWarnings(metadata, { treatAsCog: true, isSampleCog: true });
    expect(warnings.some((w) => /not fully/i.test(w) || /strip/i.test(w))).toBe(true);
    expect(warnings.some((w) => /sample/i.test(w))).toBe(true);
  });

  it('creates sample file from embedded base64 with lastModified 0', () => {
    expect(GEOTIFF_SAMPLE_BASE64.length).toBeGreaterThan(100);
    const sample = createSampleGeotiffFile();
    expect(sample.name).toBe('sample-city.tif');
    expect(sample.lastModified).toBe(0);
    expect(sample.size).toBeGreaterThan(1000);
  });

  it('parses the sample GeoTIFF', async () => {
    const sample = createSampleGeotiffFile();
    const bytes = await readGeotiffFileBytes(sample);
    const parsed = await openAndParseGeotiff(bytes, sample.name);
    expect(parsed.metadata.width).toBe(64);
    expect(parsed.metadata.height).toBe(64);
    expect(parsed.metadata.samplesPerPixel).toBe(3);
    expect(parsed.stats.bounds).toBeTruthy();
    expect(parsed.preview.dataUrl.startsWith('data:image/png')).toBe(true);
  });

  it('resolves suggestions by state', () => {
    expect(
      resolveGeotiffSuggestion({
        hasFiles: false,
        hasError: false,
        hasBounds: false
      })?.id
    ).toBe('geotiff-intro');
    expect(
      resolveGeotiffSuggestion({
        hasFiles: true,
        hasError: true,
        hasBounds: false
      })?.id
    ).toBe('geotiff-error');
  });
});
