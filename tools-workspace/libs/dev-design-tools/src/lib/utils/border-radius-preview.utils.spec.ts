import {
  buildBorderRadiusCss,
  buildBorderRadiusStyle,
  prependBorderRadiusHistory,
  resolveBorderRadiusSuggestion,
  resolvePresetUnit
} from './border-radius-preview.utils';
import { BORDER_RADIUS_PRESETS } from '../constants/border-radius-preview.constants';

describe('border-radius-preview.utils', () => {
  it('builds uniform and individual CSS shorthands', () => {
    expect(
      buildBorderRadiusCss({
        mode: 'uniform',
        uniform: 8,
        topLeft: 8,
        topRight: 8,
        bottomRight: 8,
        bottomLeft: 8,
        unit: 'px'
      })
    ).toBe('border-radius: 8px;');

    expect(
      buildBorderRadiusCss({
        mode: 'individual',
        uniform: 0,
        topLeft: 8,
        topRight: 4,
        bottomRight: 8,
        bottomLeft: 4,
        unit: 'px'
      })
    ).toBe('border-radius: 8px 4px;');

    expect(
      buildBorderRadiusStyle({
        mode: 'individual',
        uniform: 0,
        topLeft: 1,
        topRight: 2,
        bottomRight: 3,
        bottomLeft: 4,
        unit: 'rem'
      })
    ).toBe('1rem 2rem 3rem 4rem');
  });

  it('resolves preset units for Circle and Pill', () => {
    const circle = BORDER_RADIUS_PRESETS.find((preset) => preset.label === 'Circle');
    const pill = BORDER_RADIUS_PRESETS.find((preset) => preset.label === 'Pill');
    expect(circle && resolvePresetUnit(circle, 'px')).toBe('%');
    expect(pill && resolvePresetUnit(pill, 'rem')).toBe('px');
  });

  it('prepends unique history entries up to the limit', () => {
    const first = {
      timestamp: 1,
      css: 'border-radius: 8px;',
      values: {
        topLeft: 8,
        topRight: 8,
        bottomRight: 8,
        bottomLeft: 8,
        unit: 'px' as const,
        mode: 'uniform' as const
      }
    };
    const next = { ...first, timestamp: 2, css: 'border-radius: 16px;' };
    expect(prependBorderRadiusHistory([first], first)).toEqual([first]);
    expect(prependBorderRadiusHistory([first], next)).toEqual([next, first]);
  });

  it('suggests rem conversion and post-copy shadow workflow', () => {
    expect(
      resolveBorderRadiusSuggestion({
        values: {
          mode: 'uniform',
          uniform: 1,
          topLeft: 1,
          topRight: 1,
          bottomRight: 1,
          bottomLeft: 1,
          unit: 'rem'
        },
        hasCopiedCss: false
      })?.id
    ).toBe('brp-px-rem');

    expect(
      resolveBorderRadiusSuggestion({
        values: {
          mode: 'uniform',
          uniform: 8,
          topLeft: 8,
          topRight: 8,
          bottomRight: 8,
          bottomLeft: 8,
          unit: 'px'
        },
        hasCopiedCss: true
      })?.path
    ).toBe('/dev-design-tools/box-shadow-generator');
  });
});
