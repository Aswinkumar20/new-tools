import {
  boxShadowRgbToHex,
  buildBoxShadowCss,
  buildBoxShadowStyle,
  formatRelativeTimestamp,
  hexWithOpacityToRgba,
  normalizeBoxShadowColor,
  parseBoxShadowColorOpacity,
  prependBoxShadowHistory,
  resolveBoxShadowSuggestion,
  validateBoxShadowColor
} from './box-shadow-generator.utils';
import type { BoxShadowHistoryEntry, BoxShadowValues } from '../types/box-shadow-generator.types';
import { BOX_SHADOW_DEFAULTS } from '../constants/box-shadow-generator.constants';

describe('box-shadow-generator utils', () => {
  const base: BoxShadowValues = { ...BOX_SHADOW_DEFAULTS };

  it('builds CSS and style strings', () => {
    expect(buildBoxShadowStyle(base)).toBe('0px 4px 12px 0px rgba(0, 0, 0, 0.15)');
    expect(buildBoxShadowCss(base)).toBe('box-shadow: 0px 4px 12px 0px rgba(0, 0, 0, 0.15);');
  });

  it('includes inset in style output', () => {
    expect(buildBoxShadowStyle({ ...base, inset: true })).toContain('inset ');
  });

  it('normalizes and validates colors', () => {
    expect(normalizeBoxShadowColor('#abc')).toBe('#abc');
    expect(normalizeBoxShadowColor('rgba(0, 0, 0, 0.15)')).toBe('rgba(0, 0, 0, 0.15)');
    expect(normalizeBoxShadowColor('not-a-color')).toBeNull();
    expect(validateBoxShadowColor('nope')).toContain('valid color');
    expect(validateBoxShadowColor('#000000')).toBeNull();
  });

  it('parses opacity and converts hex/rgb', () => {
    expect(parseBoxShadowColorOpacity('rgba(0, 0, 0, 0.15)')).toBe(0.15);
    expect(parseBoxShadowColorOpacity('#000000')).toBe(1);
    expect(boxShadowRgbToHex('rgb(0, 123, 255)')).toBe('#007bff');
    expect(boxShadowRgbToHex('#0af')).toBe('#00aaff');
    expect(hexWithOpacityToRgba('#007bff', 0.3)).toBe('rgba(0, 123, 255, 0.3)');
  });

  it('prepends unique history and caps length', () => {
    const make = (css: string): BoxShadowHistoryEntry => ({
      timestamp: Date.now(),
      css,
      values: base
    });
    let entries: BoxShadowHistoryEntry[] = [];
    for (let i = 0; i < 12; i++) {
      entries = prependBoxShadowHistory(entries, make(`css-${i}`));
    }
    expect(entries.length).toBe(10);
    expect(prependBoxShadowHistory(entries, make('css-11'))).toEqual(entries);
  });

  it('formats relative timestamps', () => {
    const now = Date.now();
    expect(formatRelativeTimestamp(now - 10_000, now)).toBe('Just now');
    expect(formatRelativeTimestamp(now - 120_000, now)).toBe('2 minutes ago');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveBoxShadowSuggestion({
        values: { ...base, offsetX: 0, offsetY: 0, blur: 0, spread: 0 },
        hasCopiedCss: false,
        colorOpacity: 0.15
      })?.id
    ).toBe('bsg-flat-radius');

    expect(
      resolveBoxShadowSuggestion({
        values: { ...base, inset: true },
        hasCopiedCss: false,
        colorOpacity: 0.15
      })?.id
    ).toBe('bsg-inset-radius');

    expect(
      resolveBoxShadowSuggestion({
        values: base,
        hasCopiedCss: true,
        colorOpacity: 0.15
      })?.id
    ).toBe('bsg-radius');

    expect(
      resolveBoxShadowSuggestion({
        values: base,
        hasCopiedCss: false,
        colorOpacity: 0.15
      })
    ).toBeNull();
  });
});
