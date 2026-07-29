import type { IctToolSuggestion } from '../shared/ict-tool-suggestion.model';
import { COLOR_PICKER_HISTORY_LIMIT } from '../constants/color-picker.constants';
import type {
  ColorPickerHistoryEntry,
  ColorPickerResult
} from '../types/color-picker.types';
import {
  formatRgbCss,
  hexToRgb,
  hslToRgb,
  normalizeHex,
  rgbToHex,
  rgbToHsl,
  type RgbColor
} from './ict-color.utils';

export function buildColorResultFromRgb(
  rgb: RgbColor,
  alpha: number
): ColorPickerResult {
  const hsl = rgbToHsl(rgb);
  return {
    hex: rgbToHex(rgb),
    rgb,
    rgba: { ...rgb, a: alpha },
    hsl,
    hsla: { ...hsl, a: alpha },
    valid: true
  };
}

export function buildColorResultFromHex(
  hexValue: string,
  alpha: number
): { result: ColorPickerResult | null; error: string | null } {
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

export function buildColorResultFromHsl(
  hue: number,
  saturation: number,
  lightness: number,
  alpha: number
): ColorPickerResult {
  const rgb = hslToRgb(hue, saturation, lightness);
  const hsl = { h: hue, s: saturation, l: lightness };
  return {
    hex: rgbToHex(rgb),
    rgb,
    rgba: { ...rgb, a: alpha },
    hsl,
    hsla: { ...hsl, a: alpha },
    valid: true
  };
}

export function applyAlphaToColorResult(
  current: ColorPickerResult,
  alpha: number
): ColorPickerResult {
  return {
    ...current,
    rgba: { ...current.rgb, a: alpha },
    hsla: { ...current.hsl, a: alpha }
  };
}

export function createHistoryEntry(
  result: ColorPickerResult,
  now: (() => number) = Date.now
): ColorPickerHistoryEntry {
  return {
    timestamp: now(),
    hex: result.hex,
    rgb: formatRgbCss(result.rgb)
  };
}

/** Prepend history entry, skipping duplicate HEX values (existing color-picker behavior). */
export function prependUniqueHistory(
  entries: readonly ColorPickerHistoryEntry[],
  entry: ColorPickerHistoryEntry,
  limit: number = COLOR_PICKER_HISTORY_LIMIT
): ColorPickerHistoryEntry[] {
  if (entries.some((existing) => existing.hex === entry.hex)) {
    return [...entries];
  }
  return [entry, ...entries].slice(0, limit);
}

export function sampleCanvasPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): RgbColor {
  const imageData = ctx.getImageData(x, y, 1, 1);
  const [r, g, b] = imageData.data;
  return { r, g, b };
}

export function hueFromCanvasY(y: number, height: number): number {
  return Math.round((y / height) * 360);
}

export function drawSaturationLightnessCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  hue: number
): void {
  const whiteToBlack = ctx.createLinearGradient(0, 0, 0, height);
  whiteToBlack.addColorStop(0, 'rgba(255, 255, 255, 1)');
  whiteToBlack.addColorStop(1, 'rgba(0, 0, 0, 1)');
  ctx.fillStyle = whiteToBlack;
  ctx.fillRect(0, 0, width, height);

  const hueColor = hslToRgb(hue, 100, 50);
  const transparentToHue = ctx.createLinearGradient(0, 0, width, 0);
  transparentToHue.addColorStop(0, 'rgba(255, 255, 255, 0)');
  transparentToHue.addColorStop(1, `rgb(${hueColor.r}, ${hueColor.g}, ${hueColor.b})`);
  ctx.fillStyle = transparentToHue;
  ctx.fillRect(0, 0, width, height);
}

export function drawHueSpectrumCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  for (let i = 0; i < height; i++) {
    const hue = (i / height) * 360;
    const rgb = hslToRgb(hue, 100, 50);
    ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    ctx.fillRect(0, i, width, 1);
  }
}

export function resolveColorPickerSuggestion(options: {
  hasError: boolean;
  hasResult: boolean;
  alpha: number;
  historyCount: number;
}): IctToolSuggestion | null {
  const { hasError, hasResult, alpha, historyCount } = options;

  if (hasError) {
    return {
      id: 'cp-hex-help',
      title: 'HEX format looks off',
      reason:
        'Use #RGB or #RRGGBB. HEX to RGB offers a focused converter if you only need channel values.',
      actionLabel: 'Open HEX to RGB',
      path: '/image-color-tools/hex-to-rgb'
    };
  }

  if (hasResult && alpha < 1) {
    return {
      id: 'cp-alpha-gradient',
      title: 'Working with transparency?',
      reason:
        'Alpha is below 1. Gradient Generator can blend this color into soft overlays and fades.',
      actionLabel: 'Open Gradient Generator',
      path: '/image-color-tools/gradient-generator'
    };
  }

  if (historyCount >= 3) {
    return {
      id: 'cp-palette',
      title: 'Build a palette from recent picks',
      reason:
        'You have several colors in history. Palette Generator can expand one into a full scheme.',
      actionLabel: 'Open Palette Generator',
      path: '/image-color-tools/palette-generator'
    };
  }

  if (hasResult) {
    return {
      id: 'cp-gradient',
      title: 'Need shades or a gradient?',
      reason:
        'Palette Generator and Gradient Generator continue from this HEX without retyping values.',
      actionLabel: 'Open Palette Generator',
      path: '/image-color-tools/palette-generator'
    };
  }

  return {
    id: 'cp-start',
    title: 'Pick a color to get started',
    reason:
      'Use the canvas, native picker, or presets. HEX to RGB is available for quick channel-only conversion.',
    actionLabel: 'Open HEX to RGB',
    path: '/image-color-tools/hex-to-rgb'
  };
}
