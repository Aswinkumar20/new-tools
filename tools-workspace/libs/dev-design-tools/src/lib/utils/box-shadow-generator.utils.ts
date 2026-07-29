import type { DdToolSuggestion } from '../shared/dd-tool-suggestion.model';
import { BOX_SHADOW_HISTORY_LIMIT } from '../constants/box-shadow-generator.constants';
import type {
  BoxShadowHistoryEntry,
  BoxShadowPreset,
  BoxShadowValues
} from '../types/box-shadow-generator.types';

const FALLBACK_COLOR = 'rgba(0, 0, 0, 0.15)';

export function normalizeBoxShadowColor(color: string): string | null {
  const value = color.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return value;
  }
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(value)) {
    return value;
  }
  return null;
}

export function parseBoxShadowColorOpacity(color: string): number {
  const match = color.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\)/i);
  if (match) {
    return Number.parseFloat(match[1]);
  }
  return 1;
}

export function boxShadowRgbToHex(color: string): string | null {
  const value = color.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    if (value.length === 4) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }
    return value;
  }
  const match = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) {
    return null;
  }
  const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0');
  return `#${toHex(Number(match[1]))}${toHex(Number(match[2]))}${toHex(Number(match[3]))}`;
}

export function buildBoxShadowStyle(values: BoxShadowValues): string {
  const safeColor = normalizeBoxShadowColor(values.color) ?? FALLBACK_COLOR;
  const insetStr = values.inset ? 'inset ' : '';
  return `${insetStr}${values.offsetX}px ${values.offsetY}px ${values.blur}px ${values.spread}px ${safeColor}`;
}

export function buildBoxShadowCss(values: BoxShadowValues): string {
  return `box-shadow: ${buildBoxShadowStyle(values)};`;
}

export function buildBoxShadowPresetPreview(preset: BoxShadowPreset): string {
  const insetStr = preset.inset ? 'inset ' : '';
  return `${insetStr}${preset.offsetX}px ${preset.offsetY}px ${preset.blur}px ${preset.spread}px ${preset.color}`;
}

export function buildBoxShadowHistoryPreview(entry: BoxShadowHistoryEntry): string {
  const { offsetX, offsetY, blur, spread, color, inset } = entry.values;
  const insetStr = inset ? 'inset ' : '';
  return `${insetStr}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${color}`;
}

export function validateBoxShadowColor(color: string): string | null {
  const trimmed = color.trim();
  if (!trimmed || normalizeBoxShadowColor(trimmed)) {
    return null;
  }
  return 'Enter a valid color (hex like #000000 or rgb/rgba).';
}

export function hexWithOpacityToRgba(hex: string, alpha: number): string | null {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) {
    return null;
  }
  const clampedAlpha = Math.min(1, Math.max(0, alpha));
  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
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

export function prependBoxShadowHistory(
  entries: BoxShadowHistoryEntry[],
  entry: BoxShadowHistoryEntry,
  limit = BOX_SHADOW_HISTORY_LIMIT
): BoxShadowHistoryEntry[] {
  const exists = entries.some((existing) => existing.css === entry.css);
  if (exists) {
    return entries;
  }
  return [entry, ...entries].slice(0, limit);
}

export function resolveBoxShadowSuggestion(options: {
  values: BoxShadowValues;
  hasCopiedCss: boolean;
  colorOpacity: number;
}): DdToolSuggestion | null {
  const { offsetX, offsetY, blur, spread, inset } = options.values;
  const isFlat =
    offsetX === 0 && offsetY === 0 && blur === 0 && spread === 0 && !inset;

  if (isFlat) {
    return {
      id: 'bsg-flat-radius',
      title: 'Round a flat card surface?',
      reason: 'With no shadow, border-radius still softens the silhouette of cards and buttons.',
      actionLabel: 'Open Border Radius Preview',
      path: '/dev-design-tools/border-radius-preview'
    };
  }

  if (inset) {
    return {
      id: 'bsg-inset-radius',
      title: 'Pair inset shadows with rounded inputs?',
      reason: 'Inset shadows often sit on fields and chips — matching corner radius keeps the control cohesive.',
      actionLabel: 'Open Border Radius Preview',
      path: '/dev-design-tools/border-radius-preview'
    };
  }

  if (options.colorOpacity >= 1 && blur > 0) {
    return {
      id: 'bsg-soft-gradient',
      title: 'Add surface color with a gradient?',
      reason: 'Fully opaque shadows can look harsh. A soft gradient fill balances elevation on the card face.',
      actionLabel: 'Open CSS Gradient Generator',
      path: '/dev-design-tools/css-gradient-generator'
    };
  }

  if (options.hasCopiedCss) {
    return {
      id: 'bsg-radius',
      title: 'Add matching border radius?',
      reason: 'Elevated surfaces usually need rounded corners. Generate a radius next to pair with this shadow.',
      actionLabel: 'Open Border Radius Preview',
      path: '/dev-design-tools/border-radius-preview'
    };
  }

  return null;
}
