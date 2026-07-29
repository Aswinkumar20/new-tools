import {
  formatHslCss,
  formatRgbCss,
  hexColorValidator,
  hexToRgb,
  hslToRgb,
  normalizeHex,
  rgbToHex,
  rgbToHsl
} from './ict-color.utils';
import { FormControl } from '@angular/forms';
import {
  applyAlphaToColorResult,
  buildColorResultFromHex,
  buildColorResultFromHsl,
  buildColorResultFromRgb,
  createHistoryEntry,
  hueFromCanvasY,
  prependUniqueHistory,
  resolveColorPickerSuggestion
} from './color-picker.utils';

describe('ict-color.utils', () => {
  it('normalizes and converts hex/rgb/hsl', () => {
    expect(normalizeHex('#07b')).toBe('#0077BB');
    expect(normalizeHex('notahex')).toBeNull();
    expect(hexToRgb('#007BFF')).toEqual({ r: 0, g: 123, b: 255 });
    expect(rgbToHex({ r: 0, g: 123, b: 255 })).toBe('#007BFF');
    expect(rgbToHsl({ r: 0, g: 123, b: 255 }).h).toBe(211);
    expect(hslToRgb(214, 100, 50)).toEqual({ r: 0, g: 110, b: 255 });
    expect(formatRgbCss({ r: 1, g: 2, b: 3 })).toBe('rgb(1, 2, 3)');
    expect(formatHslCss({ h: 10, s: 20, l: 30 })).toBe('hsl(10, 20%, 30%)');
  });

  it('validates hex form controls', () => {
    expect(hexColorValidator(new FormControl('#fff'))).toBeNull();
    expect(hexColorValidator(new FormControl('#gggggg'))).toEqual({ invalidHex: true });
  });
});

describe('color-picker.utils', () => {
  it('builds color results and history', () => {
    const fromHex = buildColorResultFromHex('#007bff', 1);
    expect(fromHex.result?.hex).toBe('#007BFF');
    expect(fromHex.error).toBeNull();

    const fromRgb = buildColorResultFromRgb({ r: 0, g: 123, b: 255 }, 0.5);
    expect(fromRgb.rgba.a).toBe(0.5);

    const fromHsl = buildColorResultFromHsl(214, 100, 50, 1);
    expect(fromHsl.hex).toBe('#006EFF');

    const withAlpha = applyAlphaToColorResult(fromRgb, 0.25);
    expect(withAlpha.hsla.a).toBe(0.25);

    const entry = createHistoryEntry(fromRgb, () => 42);
    expect(entry.timestamp).toBe(42);
    expect(prependUniqueHistory([entry], entry)).toHaveLength(1);
    expect(hueFromCanvasY(150, 300)).toBe(180);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveColorPickerSuggestion({
        hasError: true,
        hasResult: false,
        alpha: 1,
        historyCount: 0
      })?.id
    ).toBe('cp-hex-help');

    expect(
      resolveColorPickerSuggestion({
        hasError: false,
        hasResult: true,
        alpha: 0.5,
        historyCount: 0
      })?.id
    ).toBe('cp-alpha-gradient');

    expect(
      resolveColorPickerSuggestion({
        hasError: false,
        hasResult: true,
        alpha: 1,
        historyCount: 3
      })?.id
    ).toBe('cp-palette');
  });
});
