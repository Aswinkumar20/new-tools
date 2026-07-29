import type { DdToolSuggestion } from '../shared/dd-tool-suggestion.model';
import {
  CSS_GRADIENT_FALLBACK_STYLE,
  CSS_GRADIENT_HEX_PATTERN,
  CSS_GRADIENT_HISTORY_LIMIT
} from '../constants/css-gradient-generator.constants';
import type {
  ColorStop,
  GradientFormValues,
  GradientHistoryEntry,
  GradientPreset,
  GradientResult,
  GradientType
} from '../types/css-gradient-generator.types';

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16)
      }
    : null;
}

export function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) {
    return '#007bff';
  }

  const r = Math.round(c1.r + factor * (c2.r - c1.r));
  const g = Math.round(c1.g + factor * (c2.g - c1.g));
  const b = Math.round(c1.b + factor * (c2.b - c1.b));

  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

export function validateGradientColorStops(
  colorStops: ReadonlyArray<ColorStop> | null | undefined
): string | null {
  if (!colorStops || colorStops.length < 2) {
    return 'Add at least two color stops.';
  }
  const invalidStop = colorStops.find((stop) => !CSS_GRADIENT_HEX_PATTERN.test(stop.color?.trim() ?? ''));
  if (invalidStop) {
    return 'Each color stop needs a valid hex color (#RGB or #RRGGBB).';
  }
  return null;
}

export function normalizeColorStops(colorStops: ReadonlyArray<ColorStop>): ColorStop[] {
  return colorStops
    .map((stop) => ({
      color: stop.color.trim(),
      position: Math.min(100, Math.max(0, Number(stop.position) || 0))
    }))
    .sort((a, b) => a.position - b.position);
}

export function buildGradientCss(
  type: GradientType,
  stops: ReadonlyArray<ColorStop>,
  options: { angle: number; position: string; shape: string; size: string }
): string {
  const safeAngle = Math.min(360, Math.max(0, Number(options.angle) || 0));
  const stopsString = stops.map((s) => `${s.color} ${s.position}%`).join(', ');

  switch (type) {
    case 'linear':
      return `linear-gradient(${safeAngle}deg, ${stopsString})`;
    case 'radial': {
      const shapeSize = options.size ? ` ${options.size}` : '';
      return `radial-gradient(${options.shape}${shapeSize} at ${options.position || 'center'}, ${stopsString})`;
    }
    case 'conic':
      return `conic-gradient(from ${safeAngle}deg at ${options.position || 'center'}, ${stopsString})`;
    default:
      return `linear-gradient(${safeAngle}deg, ${stopsString})`;
  }
}

export function buildGradientResult(values: GradientFormValues): GradientResult | { error: string } {
  const validationError = validateGradientColorStops(values.colorStops);
  if (validationError === 'Add at least two color stops.') {
    return { error: validationError };
  }
  if (validationError) {
    return { error: validationError };
  }

  const safeAngle = Math.min(360, Math.max(0, Number(values.angle) || 0));
  const stops = normalizeColorStops(values.colorStops);
  const type = values.type ?? 'linear';
  const css = buildGradientCss(type, stops, {
    angle: safeAngle,
    position: values.position,
    shape: values.shape,
    size: values.size
  });

  return {
    css,
    type,
    colors: stops,
    angle: type === 'linear' || type === 'conic' ? safeAngle : undefined,
    position: type === 'radial' || type === 'conic' ? values.position : undefined,
    shape: type === 'radial' ? values.shape : undefined,
    size: type === 'radial' ? values.size : undefined
  };
}

export function resolveGradientStyle(result: GradientResult | null): string {
  return result ? result.css : CSS_GRADIENT_FALLBACK_STYLE;
}

export function buildPresetPreview(preset: GradientPreset): string {
  const stops = preset.colors.map((s) => `${s.color} ${s.position}%`).join(', ');
  switch (preset.type) {
    case 'linear':
      return `linear-gradient(${preset.angle ?? 90}deg, ${stops})`;
    case 'radial':
      return `radial-gradient(${preset.shape ?? 'ellipse'} at ${preset.position ?? 'center'}, ${stops})`;
    case 'conic':
      return `conic-gradient(from ${preset.angle ?? 0}deg at ${preset.position ?? 'center'}, ${stops})`;
    default:
      return `linear-gradient(90deg, ${stops})`;
  }
}

export function capitalizeGradientType(type: GradientType | string | null | undefined): string {
  if (!type) {
    return '';
  }
  return type.charAt(0).toUpperCase() + type.slice(1);
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

export function prependGradientHistory(
  entries: GradientHistoryEntry[],
  entry: GradientHistoryEntry,
  limit = CSS_GRADIENT_HISTORY_LIMIT
): GradientHistoryEntry[] {
  const exists = entries.some((existing) => existing.css === entry.css);
  if (exists) {
    return entries;
  }
  return [entry, ...entries].slice(0, limit);
}

export function resolveCssGradientSuggestion(options: {
  result: GradientResult | null;
  hasCopiedCss: boolean;
  stopCount: number;
}): DdToolSuggestion | null {
  const { result, hasCopiedCss, stopCount } = options;
  if (!result) {
    return null;
  }

  if (result.type === 'radial' || result.type === 'conic') {
    return {
      id: 'cgg-radius',
      title: 'Round the surface using this gradient?',
      reason: 'Radial and conic fills often sit on circular or pill-shaped elements. Match the silhouette next.',
      actionLabel: 'Open Border Radius Preview',
      path: '/dev-design-tools/border-radius-preview'
    };
  }

  if (stopCount >= 5) {
    return {
      id: 'cgg-shadow',
      title: 'Add elevation to a multi-stop card?',
      reason: 'Rich gradients pair well with soft shadows so the surface reads as a raised panel.',
      actionLabel: 'Open Box Shadow Generator',
      path: '/dev-design-tools/box-shadow-generator'
    };
  }

  if (hasCopiedCss) {
    return {
      id: 'cgg-copied-shadow',
      title: 'Pair this gradient with a box shadow?',
      reason: 'Copied gradient CSS is ready for a card or button. Generate a matching shadow next.',
      actionLabel: 'Open Box Shadow Generator',
      path: '/dev-design-tools/box-shadow-generator'
    };
  }

  return null;
}
