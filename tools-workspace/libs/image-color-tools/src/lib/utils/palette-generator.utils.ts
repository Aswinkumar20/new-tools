import type { SafeUrl } from '@angular/platform-browser';
import type { IctToolSuggestion } from '../shared/ict-tool-suggestion.model';
import { ictFormatBytes } from '../shared/ict-format.util';
import {
  PALETTE_ERROR,
  PALETTE_EXTRACTION_METHODS,
  PALETTE_HISTORY_LIMIT,
  PALETTE_MAX_FILE_SIZE,
  PALETTE_QUANTIZE_STEP,
  PALETTE_SAMPLE_BUDGET,
  PALETTE_SAMPLE_MAX_SIZE
} from '../constants/palette-generator.constants';
import type {
  PaletteColorInfo,
  PaletteHistoryEntry,
  PaletteResult,
  QuantizedColorCount
} from '../types/palette-generator.types';
import { rgbToHex, rgbToHsl } from './ict-color.utils';

export function validatePaletteFile(file: File): {
  errors: string[] | null;
  isOversized: boolean;
} {
  if (!file.type.startsWith('image/')) {
    return { errors: [PALETTE_ERROR.invalidImage], isOversized: false };
  }
  if (file.size > PALETTE_MAX_FILE_SIZE) {
    return {
      errors: [
        `File size ${ictFormatBytes(file.size)} exceeds the ${ictFormatBytes(PALETTE_MAX_FILE_SIZE)} limit.`,
        'Consider compressing the image before processing.'
      ],
      isOversized: true
    };
  }
  return { errors: null, isOversized: false };
}

export function resolvePaletteMethodLabel(method: string): string {
  return PALETTE_EXTRACTION_METHODS.find((m) => m.value === method)?.label ?? method;
}

export function filterColorsByMethod(
  colors: QuantizedColorCount[],
  method: string
): QuantizedColorCount[] {
  switch (method) {
    case 'vibrant':
      return colors.filter((c) => {
        const hsl = rgbToHsl({ r: c.r, g: c.g, b: c.b });
        return hsl.s > 50 && hsl.l > 30 && hsl.l < 70;
      });
    case 'muted':
      return colors.filter((c) => {
        const hsl = rgbToHsl({ r: c.r, g: c.g, b: c.b });
        return hsl.s < 50;
      });
    case 'light':
      return colors.filter((c) => {
        const hsl = rgbToHsl({ r: c.r, g: c.g, b: c.b });
        return hsl.l > 60;
      });
    case 'dark':
      return colors.filter((c) => {
        const hsl = rgbToHsl({ r: c.r, g: c.g, b: c.b });
        return hsl.l < 40;
      });
    default:
      return colors;
  }
}

/** Build quantized frequency map from ImageData (existing sampling algorithm). */
export function collectQuantizedColors(imageData: ImageData): QuantizedColorCount[] {
  const pixels = imageData.data;
  const colorMap = new Map<string, QuantizedColorCount>();
  const sampleRate = Math.max(1, Math.floor(pixels.length / 4 / PALETTE_SAMPLE_BUDGET));

  for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    if (a < 128) {
      continue;
    }

    const qr = Math.floor(r / PALETTE_QUANTIZE_STEP) * PALETTE_QUANTIZE_STEP;
    const qg = Math.floor(g / PALETTE_QUANTIZE_STEP) * PALETTE_QUANTIZE_STEP;
    const qb = Math.floor(b / PALETTE_QUANTIZE_STEP) * PALETTE_QUANTIZE_STEP;
    const key = `${qr},${qg},${qb}`;

    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { r: qr, g: qg, b: qb, count: 1 });
    }
  }

  return Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
}

export function buildPaletteColorInfos(
  filteredColors: QuantizedColorCount[],
  count: number
): PaletteColorInfo[] {
  const selected = filteredColors.slice(0, count);
  const total = selected.reduce((sum, c) => sum + c.count, 0) || 1;

  return selected.map((color) => {
    const rgb = { r: color.r, g: color.g, b: color.b };
    return {
      hex: rgbToHex(rgb),
      rgb,
      hsl: rgbToHsl(rgb),
      percentage: Math.round((color.count / total) * 100)
    };
  });
}

export function extractPaletteFromImageData(
  imageData: ImageData,
  count: number,
  method: string
): PaletteColorInfo[] {
  const quantized = collectQuantizedColors(imageData);
  const filtered = filterColorsByMethod(quantized, method);
  return buildPaletteColorInfos(filtered, count);
}

export function computePaletteSampleScale(width: number, height: number): number {
  return Math.min(PALETTE_SAMPLE_MAX_SIZE / width, PALETTE_SAMPLE_MAX_SIZE / height);
}

export function buildPaletteCssExport(colors: readonly PaletteColorInfo[]): string {
  return colors
    .map(
      (color, index) =>
        `/* Color ${index + 1} - ${color.percentage}% */\n--color-${index + 1}: ${color.hex};\n--color-${index + 1}-rgb: ${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b};\n--color-${index + 1}-hsl: ${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%;`
    )
    .join('\n\n');
}

export function buildPaletteCssFilename(filename: string | null): string {
  const base = filename?.replace(/\.[^/.]+$/, '') ?? 'palette';
  return `${base}.css`;
}

export function extractSafeUrlString(previewUrl: SafeUrl | string): string {
  if (typeof previewUrl === 'string') {
    return previewUrl;
  }
  return (
    (previewUrl as { changingThisBreaksApplicationSecurity?: string })
      ?.changingThisBreaksApplicationSecurity || ''
  );
}

export function createPaletteHistoryEntry(
  result: PaletteResult,
  now: (() => number) = Date.now
): PaletteHistoryEntry {
  return {
    timestamp: now(),
    filename: result.filename,
    colors: result.colors,
    preview: extractSafeUrlString(result.previewUrl)
  };
}

/** Prepend history, skipping palettes with identical HEX sequences. */
export function prependPaletteHistory(
  entries: readonly PaletteHistoryEntry[],
  entry: PaletteHistoryEntry,
  limit: number = PALETTE_HISTORY_LIMIT
): PaletteHistoryEntry[] {
  const exists = entries.some(
    (e) =>
      e.colors.length === entry.colors.length &&
      e.colors.every((c, i) => c.hex === entry.colors[i]?.hex)
  );
  if (exists) {
    return [...entries];
  }
  return [entry, ...entries].slice(0, limit);
}

export function resolvePaletteSuggestion(options: {
  hasFile: boolean;
  hasResult: boolean;
  hasError: boolean;
  isOversizedHint: boolean;
  colorCount: number;
  method: string;
}): IctToolSuggestion | null {
  const { hasFile, hasResult, hasError, isOversizedHint, colorCount, method } = options;

  if (hasError && isOversizedHint) {
    return {
      id: 'pg-oversized',
      title: 'Image is too large to sample',
      reason:
        'Uploads cap at 25 MB. Compress first so palette extraction stays fast in the browser.',
      actionLabel: 'Open Image Compressor',
      path: '/image-color-tools/image-compressor'
    };
  }

  if (hasError && !hasFile) {
    return {
      id: 'pg-invalid',
      title: 'That file is not a usable image',
      reason:
        'Choose a JPEG, PNG, or WebP photo. Drawing Pad can create a simple swatch image to test methods.',
      actionLabel: 'Open Drawing Pad',
      path: '/image-color-tools/drawing-pad'
    };
  }

  if (!hasFile) {
    return {
      id: 'pg-start',
      title: 'Upload an image to build a palette',
      reason:
        'Dominant, vibrant, muted, light, and dark methods pull HEX/RGB/HSL from your photo.',
      actionLabel: 'Open Color Picker',
      path: '/image-color-tools/color-picker'
    };
  }

  if (hasResult && colorCount <= 2) {
    return {
      id: 'pg-few-colors',
      title: 'Only a few colors came through',
      reason:
        'Try Dominant mode or raise the color count. Color Picker helps when you need one exact brand HEX.',
      actionLabel: 'Open Color Picker',
      path: '/image-color-tools/color-picker'
    };
  }

  if (hasResult && method === 'vibrant') {
    return {
      id: 'pg-gradient',
      title: 'Turn vibrant stops into a gradient?',
      reason:
        'Gradient Generator can blend these saturated colors into CSS backgrounds.',
      actionLabel: 'Open Gradient Generator',
      path: '/image-color-tools/gradient-generator'
    };
  }

  if (hasResult) {
    return {
      id: 'pg-next',
      title: 'Palette ready — refine or convert?',
      reason:
        'Copy HEX values, convert with HEX to RGB, or feed stops into Gradient Generator.',
      actionLabel: 'Open HEX to RGB',
      path: '/image-color-tools/hex-to-rgb'
    };
  }

  return {
    id: 'pg-ready',
    title: 'Ready to extract colors',
    reason:
      'Adjust color count and method, then wait for sampling. Compress large photos first for speed.',
    actionLabel: 'Open Image Compressor',
    path: '/image-color-tools/image-compressor'
  };
}
