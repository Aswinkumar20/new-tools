import {
  buildHexRgbResultFromHex,
  buildHexRgbResultFromRgb,
  createHexRgbHistoryEntry,
  prependHexRgbHistory,
  resolveHexRgbSuggestion
} from './hex-to-rgb.utils';

describe('hex-to-rgb.utils', () => {
  it('builds results from hex and rgb', () => {
    const fromHex = buildHexRgbResultFromHex('#007bff', 1);
    expect(fromHex.error).toBeNull();
    expect(fromHex.result?.hex).toBe('#007BFF');
    expect(fromHex.result?.rgb).toEqual({ r: 0, g: 123, b: 255 });

    expect(buildHexRgbResultFromHex('#gggggg', 1).error).toBe('invalidHex');
    expect(buildHexRgbResultFromHex('notahex', 1).error).toBe('invalidHex');

    const fromRgb = buildHexRgbResultFromRgb(0, 123, 255, 0.5);
    expect(fromRgb.result?.hex).toBe('#007BFF');
    expect(fromRgb.result?.hsla.a).toBe(0.5);
    expect(buildHexRgbResultFromRgb(-1, 0, 0, 1).error).toBe('rgbRange');
  });

  it('prepends history without deduping', () => {
    const entry = createHexRgbHistoryEntry(
      {
        hex: '#007BFF',
        rgb: { r: 0, g: 123, b: 255 },
        rgba: { r: 0, g: 123, b: 255, a: 1 },
        hsl: { h: 211, s: 100, l: 50 },
        hsla: { h: 211, s: 100, l: 50, a: 1 },
        valid: true
      },
      () => 1
    );
    expect(prependHexRgbHistory([entry], entry)).toHaveLength(2);
  });

  it('resolves suggestions', () => {
    expect(
      resolveHexRgbSuggestion({
        inputMode: 'hex',
        hasResult: false,
        hasError: true,
        alpha: 1,
        historyCount: 0
      })?.id
    ).toBe('htr-hex-help');

    expect(
      resolveHexRgbSuggestion({
        inputMode: 'rgb',
        hasResult: true,
        hasError: false,
        alpha: 1,
        historyCount: 0
      })?.id
    ).toBe('htr-palette');
  });
});
