import { buildPyramidLevels, pickPyramidLevel } from './wsi-pyramid.utils';
import { extensionPreferenceWarning } from './wsi-image-load.utils';
import { exportAnnotationsJson } from './pathology-annotation.utils';
import { createSamplePathologyFile, createPathologySlideRecord } from './pathology-slide-viewer.utils';
import { readFileBytes } from './medical-file.utils';

describe('pathology-slide-viewer.utils', () => {
  it('warns on svs extension', () => {
    expect(extensionPreferenceWarning('.png')).toBeNull();
    expect(extensionPreferenceWarning('.svs')).toContain('pyramid');
  });

  it('creates sample with lastModified 0', () => {
    const sample = createSamplePathologyFile();
    expect(sample.name).toBe('sample-he-slide.png');
    expect(sample.lastModified).toBe(0);
  });

  it('exports annotations json', () => {
    const json = exportAnnotationsJson(
      [{ id: 'a1', type: 'point', label: 'Focus', x: 10, y: 20, color: '#f00' }],
      'slide.png',
      { width: 128, height: 128 }
    );
    expect(JSON.parse(json).annotations.length).toBe(1);
  });

  it('builds pyramid levels for slide record', async () => {
    const sample = createSamplePathologyFile();
    const bytes = await readFileBytes(sample);
    const record = createPathologySlideRecord(sample, bytes);
    const levels = buildPyramidLevels(128, 128);
    expect(levels.length).toBeGreaterThan(1);
    expect(pickPyramidLevel(levels, 2).level).toBe(0);
  });
});
