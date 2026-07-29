import type { IctToolSuggestion } from '../shared/ict-tool-suggestion.model';
import { HEX_RGB_HISTORY_LIMIT } from '../constants/hex-to-rgb.constants';
import type {
  HexRgbColorResult,
  HexRgbHistoryEntry,
  HexRgbInputMode
} from '../types/hex-to-rgb.types';
import {
  formatRgbCss,
  hexToRgb,
  isRgbInRange,
  normalizeHex,
  rgbToHex,
  rgbToHsl,
  type RgbColor
} from './ict-color.utils';

export function buildHexRgbResultFromHex(
  hexValue: string,
  alpha: number
): { result: HexRgbColorResult | null; error: 'invalidHex' | 'parseHex' | null } {
  const normalized = normalizeHex(hexValue);
  if (!normalized) {
    return { result: null, error: 'invalidHex' };
  }
  const rgb = hexToRgb(normalized);
  if (!rgb) {
    return { result: null, error: 'parseHex' };
  }
  const hsl = rgbToHsl(rgb);
  return {
    result: {
      hex: normalized,
      rgb,
      rgba: { ...rgb, a: alpha },
      hsl,
      hsla: { ...hsl, a: alpha },
      valid: true
    },
    error: null
  };
}

export function buildHexRgbResultFromRgb(
  red: number,
  green: number,
  blue: number,
  alpha: number
): { result: HexRgbColorResult | null; error: 'rgbRange' | null } {
  if (!isRgbInRange(red, green, blue)) {
    return { result: null, error: 'rgbRange' };
  }
  const rgb: RgbColor = { r: red, g: green, b: blue };
  const hsl = rgbToHsl(rgb);
  return {
    result: {
      hex: rgbToHex(rgb),
      rgb,
      rgba: { ...rgb, a: alpha },
      hsl,
      hsla: { ...hsl, a: alpha },
      valid: true
    },
    error: null
  };
}

export function createHexRgbHistoryEntry(
  result: HexRgbColorResult,
  now: (() => number) = Date.now
): HexRgbHistoryEntry {
  return {
    timestamp: now(),
    hex: result.hex,
    rgb: formatRgbCss(result.rgb)
  };
}

/** Always prepend (existing hex-to-rgb behavior — does not dedupe). */
export function prependHexRgbHistory(
  entries: readonly HexRgbHistoryEntry[],
  entry: HexRgbHistoryEntry,
  limit: number = HEX_RGB_HISTORY_LIMIT
): HexRgbHistoryEntry[] {
  return [entry, ...entries].slice(0, limit);
}

export function resolveHexRgbSuggestion(options: {
  inputMode: HexRgbInputMode;
  hasResult: boolean;
  hasError: boolean;
  alpha: number;
  historyCount: number;
}): IctToolSuggestion | null {
  const { inputMode, hasResult, hasError, alpha, historyCount } = options;

  if (hasError) {
    return {
      id: 'htr-hex-help',
      title: 'Color format looks off',
      reason:
        'Use #RGB / #RRGGBB or RGB channels 0–255. Color Picker offers a visual canvas if typing is awkward.',
      actionLabel: 'Open Color Picker',
      path: '/image-color-tools/color-picker'
    };
  }

  if (hasResult && alpha < 1) {
    return {
      id: 'htr-alpha-gradient',
      title: 'Working with transparency?',
      reason:
        'Alpha is below 1. Gradient Generator can blend this RGBA into soft overlays.',
      actionLabel: 'Open Gradient Generator',
      path: '/image-color-tools/gradient-generator'
    };
  }

  if (hasResult && inputMode === 'rgb') {
    return {
      id: 'htr-palette',
      title: 'Build a palette from this RGB?',
      reason:
        'Palette Generator expands a base color into harmonious sets for UI themes.',
      actionLabel: 'Open Palette Generator',
      path: '/image-color-tools/palette-generator'
    };
  }

  if (hasResult) {
    return {
      id: 'htr-picker',
      title: 'Need a visual picker?',
      reason:
        'Color Picker adds canvas picking and HSL sliders while keeping HEX/RGB/HSL outputs.',
      actionLabel: 'Open Color Picker',
      path: '/image-color-tools/color-picker'
    };
  }

  if (historyCount > 0) {
    return {
      id: 'htr-history',
      title: 'Reuse a recent conversion',
      reason:
        'History stores HEX/RGB pairs. Apply one, then jump to Gradient Generator for backgrounds.',
      actionLabel: 'Open Gradient Generator',
      path: '/image-color-tools/gradient-generator'
    };
  }

  return {
    id: 'htr-start',
    title: 'Convert HEX ↔ RGB',
    reason:
      'Enter a HEX or RGB value to see live HSL outputs. Color Picker helps when you prefer clicking a swatch.',
    actionLabel: 'Open Color Picker',
    path: '/image-color-tools/color-picker'
  };
}
