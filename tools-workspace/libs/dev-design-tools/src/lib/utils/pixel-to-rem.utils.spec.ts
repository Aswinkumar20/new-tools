import {
  calculatePixelRemConversion,
  formatPixelRemOutput,
  formatRelativeTimestamp,
  prependPixelRemHistory,
  pxToRem,
  resolvePixelRemSuggestion,
  validatePixelRemInputs
} from './pixel-to-rem.utils';
import type { PixelRemHistoryEntry } from '../types/pixel-to-rem.types';

describe('pixel-to-rem utils', () => {
  it('converts px to rem and rem to px', () => {
    const toRem = calculatePixelRemConversion({
      direction: 'px-to-rem',
      inputValue: 16,
      baseSize: 16
    });
    expect(toRem?.output).toBe(1);
    expect(toRem?.formula).toContain('rem');

    const toPx = calculatePixelRemConversion({
      direction: 'rem-to-px',
      inputValue: 1.5,
      baseSize: 16
    });
    expect(toPx?.output).toBe(24);
  });

  it('formats outputs and validates inputs', () => {
    expect(formatPixelRemOutput(1, 'px-to-rem')).toBe('1');
    expect(formatPixelRemOutput(0.625, 'px-to-rem')).toBe('0.625');
    expect(formatPixelRemOutput(24.5, 'rem-to-px')).toBe('24.5');
    expect(pxToRem(32, 16)).toBe(2);
    expect(validatePixelRemInputs({ inputValid: false, baseValid: true })[0]).toContain('0 or greater');
  });

  it('prepends unique history and formats timestamps', () => {
    const entry: PixelRemHistoryEntry = {
      timestamp: 1,
      input: 16,
      output: 1,
      direction: 'px-to-rem',
      baseSize: 16
    };
    expect(prependPixelRemHistory([entry], entry)).toHaveLength(1);
    expect(formatRelativeTimestamp(Date.now() - 5_000)).toBe('Just now');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolvePixelRemSuggestion({
        values: { direction: 'px-to-rem', inputValue: 16, baseSize: 16 },
        hasResult: true,
        hasCopiedResult: false
      })
    ).toBeNull();

    expect(
      resolvePixelRemSuggestion({
        values: { direction: 'px-to-rem', inputValue: 16, baseSize: 18 },
        hasResult: true,
        hasCopiedResult: false
      })?.id
    ).toBe('ptr-radius');

    expect(
      resolvePixelRemSuggestion({
        values: { direction: 'px-to-rem', inputValue: 16, baseSize: 16 },
        hasResult: true,
        hasCopiedResult: true
      })?.id
    ).toBe('ptr-shadow');
  });
});
