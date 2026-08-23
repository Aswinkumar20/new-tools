import { buildPyramidLevels, pickPyramidLevel, computeVisibleImageRect } from './wsi-pyramid.utils';
import { createSampleWholeSlideFile, createWholeSlideRecord, applyWholeSlideDimensions } from './whole-slide-image-viewer.utils';
import { exportRegionsJson } from './wsi-region.utils';
import { readFileBytes } from './medical-file.utils';

describe('whole-slide-image-viewer.utils', () => {
  it('creates sample with lastModified 0', () => {
    const sample = createSampleWholeSlideFile();
    expect(sample.name).toBe('sample-wsi-slide.png');
    expect(sample.lastModified).toBe(0);
  });

  it('applies dimensions and pyramid count', async () => {
    const sample = createSampleWholeSlideFile();
    const bytes = await readFileBytes(sample);
    const record = applyWholeSlideDimensions(createWholeSlideRecord(sample, bytes), 128, 128);
    expect(record.fullWidth).toBe(128);
    expect(record.pyramidLevelCount).toBeGreaterThan(1);
  });

  it('picks pyramid level by zoom', () => {
    const levels = buildPyramidLevels(1024, 1024);
    expect(pickPyramidLevel(levels, 0.1).downsample).toBeGreaterThan(1);
  });

  it('computes visible rect and exports regions', () => {
    const rect = computeVisibleImageRect({ zoom: 1, panX: 0, panY: 0 }, 400, 300, 128, 128);
    expect(rect.width).toBeGreaterThan(0);
    const json = exportRegionsJson(
      [{ id: 'r1', name: 'ROI 1', x: 0, y: 0, width: 32, height: 32, color: '#f59e0b' }],
      'wsi.png',
      { width: 128, height: 128 }
    );
    expect(JSON.parse(json).regions.length).toBe(1);
  });
});
