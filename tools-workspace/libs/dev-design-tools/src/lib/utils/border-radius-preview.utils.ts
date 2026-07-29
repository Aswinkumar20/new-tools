import type { DdToolSuggestion } from '../shared/dd-tool-suggestion.model';
import type {
  BorderRadiusCornerValues,
  BorderRadiusHistoryEntry,
  BorderRadiusPreset,
  BorderRadiusUnit
} from '../types/border-radius-preview.types';
import { BORDER_RADIUS_HISTORY_LIMIT } from '../constants/border-radius-preview.constants';

export function buildBorderRadiusCss(values: BorderRadiusCornerValues): string {
  const { mode, uniform, topLeft, topRight, bottomRight, bottomLeft, unit } = values;

  if (mode === 'uniform') {
    return `border-radius: ${uniform}${unit};`;
  }

  // Always emit 4-value shorthand so TL/TR/BR/BL map correctly
  // (CSS 2-value form is TL+BR / TR+BL, not top/bottom pairs).
  if (topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft) {
    return `border-radius: ${topLeft}${unit};`;
  }

  if (topLeft === bottomRight && topRight === bottomLeft) {
    return `border-radius: ${topLeft}${unit} ${topRight}${unit};`;
  }

  return `border-radius: ${topLeft}${unit} ${topRight}${unit} ${bottomRight}${unit} ${bottomLeft}${unit};`;
}

export function buildBorderRadiusStyle(values: BorderRadiusCornerValues): string {
  const { mode, uniform, topLeft, topRight, bottomRight, bottomLeft, unit } = values;

  if (mode === 'uniform') {
    return `${uniform}${unit}`;
  }

  return `${topLeft}${unit} ${topRight}${unit} ${bottomRight}${unit} ${bottomLeft}${unit}`;
}

export function resolvePresetUnit(
  preset: BorderRadiusPreset,
  currentUnit: BorderRadiusUnit
): BorderRadiusUnit {
  if (preset.label === 'Circle') {
    return '%';
  }
  if (preset.label === 'Pill') {
    return 'px';
  }
  return currentUnit;
}

export function buildPresetPreview(preset: BorderRadiusPreset): string {
  const unit = preset.label === 'Circle' ? '%' : 'px';
  return `${preset.topLeft}${unit} ${preset.topRight}${unit} ${preset.bottomRight}${unit} ${preset.bottomLeft}${unit}`;
}

export function buildHistoryPreview(entry: BorderRadiusHistoryEntry): string {
  const { topLeft, topRight, bottomRight, bottomLeft, unit } = entry.values;
  const u = unit ?? 'px';
  return `${topLeft}${u} ${topRight}${u} ${bottomRight}${u} ${bottomLeft}${u}`;
}

export function formatRelativeTimestamp(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (days < 7) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString();
}

export function prependBorderRadiusHistory(
  entries: BorderRadiusHistoryEntry[],
  entry: BorderRadiusHistoryEntry,
  limit = BORDER_RADIUS_HISTORY_LIMIT
): BorderRadiusHistoryEntry[] {
  const exists = entries.some((existing) => existing.css === entry.css);
  if (exists) {
    return entries;
  }
  return [entry, ...entries].slice(0, limit);
}

export function resolveBorderRadiusSuggestion(options: {
  values: BorderRadiusCornerValues;
  hasCopiedCss: boolean;
}): DdToolSuggestion | null {
  const { mode, uniform, topLeft, topRight, bottomRight, bottomLeft, unit } = options.values;
  const corners = mode === 'uniform' ? [uniform, uniform, uniform, uniform] : [topLeft, topRight, bottomRight, bottomLeft];
  const allEqual = corners.every((value) => value === corners[0]);
  const radius = corners[0];

  if (allEqual && radius === 50 && unit !== '%') {
    return {
      id: 'brp-circle-percent',
      title: 'Use % for a true circle?',
      reason: '50 with a length unit rarely produces a circle. The Circle preset uses 50%.',
      actionLabel: 'Open Pixel to Rem',
      path: '/dev-design-tools/pixel-to-rem'
    };
  }

  if ((unit === 'rem' || unit === 'em') && radius > 0) {
    return {
      id: 'brp-px-rem',
      title: 'Convert between px and rem?',
      reason: 'Pixel to Rem helps keep spacing tokens consistent across your design system.',
      actionLabel: 'Open Pixel to Rem',
      path: '/dev-design-tools/pixel-to-rem'
    };
  }

  if (options.hasCopiedCss) {
    return {
      id: 'brp-shadow',
      title: 'Add a matching box shadow?',
      reason: 'Rounded surfaces often need elevation. Generate a shadow next to pair with this radius.',
      actionLabel: 'Open Box Shadow Generator',
      path: '/dev-design-tools/box-shadow-generator'
    };
  }

  if (allEqual && radius === 0) {
    return {
      id: 'brp-gradient',
      title: 'Style a sharp card surface?',
      reason: 'With no rounding, gradients can still give the surface visual depth.',
      actionLabel: 'Open CSS Gradient Generator',
      path: '/dev-design-tools/css-gradient-generator'
    };
  }

  return null;
}
