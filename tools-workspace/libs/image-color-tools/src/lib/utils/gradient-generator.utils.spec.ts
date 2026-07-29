import {
  buildGradientCss,
  buildGradientResult,
  buildPresetPreviewCss,
  createGradientHistoryEntry,
  formatRelativeTimestamp,
  nextColorStopPosition,
  parseGradientTypeFromCss,
  prependUniqueGradientHistory,
  resolveGradientSuggestion,
  titleCaseGradientType
} from './gradient-generator.utils';

describe('gradient-generator.utils', () => {
  it('builds linear, radial, and conic CSS', () => {
    const stops = [
      { color: '#007bff', position: 0 },
      { color: '#0056b3', position: 100 }
    ];
    expect(
      buildGradientCss({
        type: 'linear',
        angle: 90,
        position: 'center',
        shape: 'ellipse',
        size: 'farthest-corner',
        stops
      })
    ).toBe('linear-gradient(90deg, #007bff 0%, #0056b3 100%)');

    expect(
      buildGradientCss({
        type: 'radial',
        angle: 0,
        position: 'center',
        shape: 'ellipse',
        size: 'farthest-corner',
        stops
      })
    ).toBe('radial-gradient(ellipse, farthest-corner at center, #007bff 0%, #0056b3 100%)');

    expect(
      buildGradientResult({
        type: 'conic',
        angle: 0,
        position: 'center',
        shape: 'ellipse',
        size: 'farthest-corner',
        stops
      }).css
    ).toContain('conic-gradient(from 0deg at center');
  });

  it('builds preset previews and history helpers', () => {
    expect(
      buildPresetPreviewCss({
        label: 'Sunset',
        description: 'Linear',
        type: 'linear',
        angle: 45,
        colors: [
          { color: '#FF6B6B', position: 0 },
          { color: '#FFE66D', position: 100 }
        ]
      })
    ).toContain('linear-gradient(45deg');

    const entry = createGradientHistoryEntry(
      {
        css: 'linear-gradient(90deg, #000 0%, #fff 100%)',
        type: 'linear',
        colors: []
      },
      () => 1
    );
    expect(prependUniqueGradientHistory([entry], entry)).toHaveLength(1);
    expect(parseGradientTypeFromCss(entry.css)).toBe('linear');
    expect(formatRelativeTimestamp(Date.now(), () => Date.now())).toBe('Just now');
    expect(nextColorStopPosition(90)).toBe(100);
    expect(titleCaseGradientType('radial')).toBe('Radial');
  });

  it('resolves suggestions', () => {
    expect(
      resolveGradientSuggestion({
        type: 'linear',
        stopCount: 2,
        hasResult: false,
        hasError: true,
        historyCount: 0
      })?.id
    ).toBe('gg-min-stops');

    expect(
      resolveGradientSuggestion({
        type: 'conic',
        stopCount: 3,
        hasResult: true,
        hasError: false,
        historyCount: 0
      })?.id
    ).toBe('gg-favicon');
  });
});
