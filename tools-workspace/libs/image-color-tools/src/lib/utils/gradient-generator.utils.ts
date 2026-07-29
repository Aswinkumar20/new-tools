import type { IctToolSuggestion } from '../shared/ict-tool-suggestion.model';
import {
  GRADIENT_DEFAULT_PREVIEW,
  GRADIENT_HISTORY_LIMIT
} from '../constants/gradient-generator.constants';
import type {
  GradientColorStop,
  GradientHistoryEntry,
  GradientPreset,
  GradientResult,
  GradientType
} from '../types/gradient-generator.types';

export function sortGradientStops(
  stops: readonly GradientColorStop[]
): GradientColorStop[] {
  return [...stops].sort((a, b) => a.position - b.position);
}

export function formatGradientStopsCss(stops: readonly GradientColorStop[]): string {
  return stops.map((stop) => `${stop.color} ${stop.position}%`).join(', ');
}

export function buildGradientCss(options: {
  type: GradientType;
  angle: number;
  position: string;
  shape: string;
  size: string;
  stops: readonly GradientColorStop[];
}): string {
  const { type, angle, position, shape, size } = options;
  const stopsCss = formatGradientStopsCss(sortGradientStops(options.stops));

  switch (type) {
    case 'linear':
      return `linear-gradient(${angle}deg, ${stopsCss})`;
    case 'radial': {
      const shapeSize = size ? `, ${size}` : '';
      return `radial-gradient(${shape}${shapeSize} at ${position}, ${stopsCss})`;
    }
    case 'conic':
      return `conic-gradient(from ${angle}deg at ${position}, ${stopsCss})`;
    default:
      return `linear-gradient(90deg, ${stopsCss})`;
  }
}

export function buildGradientResult(options: {
  type: GradientType;
  angle: number;
  position: string;
  shape: string;
  size: string;
  stops: readonly GradientColorStop[];
}): GradientResult {
  const stops = sortGradientStops(options.stops);
  const css = buildGradientCss({ ...options, stops });

  return {
    css,
    type: options.type ?? 'linear',
    colors: stops,
    angle: options.type === 'linear' || options.type === 'conic' ? options.angle : undefined,
    position:
      options.type === 'radial' || options.type === 'conic' ? options.position : undefined,
    shape: options.type === 'radial' ? options.shape : undefined,
    size: options.type === 'radial' ? options.size : undefined
  };
}

/** Preset preview CSS (preserves existing radial preview format, which differs slightly from export). */
export function buildPresetPreviewCss(preset: GradientPreset): string {
  const stops = formatGradientStopsCss(preset.colors);
  switch (preset.type) {
    case 'linear':
      return `linear-gradient(${preset.angle ?? 90}deg, ${stops})`;
    case 'radial': {
      const shapeSize = preset.shape ? `${preset.shape} ` : '';
      return `radial-gradient(${shapeSize}at ${preset.position ?? 'center'}, ${stops})`;
    }
    case 'conic':
      return `conic-gradient(from ${preset.angle ?? 0}deg at ${preset.position ?? 'center'}, ${stops})`;
    default:
      return `linear-gradient(90deg, ${stops})`;
  }
}

export function resolveGradientPreviewCss(result: GradientResult | null): string {
  return result ? result.css : GRADIENT_DEFAULT_PREVIEW;
}

export function createGradientHistoryEntry(
  result: GradientResult,
  now: (() => number) = Date.now
): GradientHistoryEntry {
  return {
    timestamp: now(),
    css: result.css,
    preview: result.css
  };
}

export function prependUniqueGradientHistory(
  entries: readonly GradientHistoryEntry[],
  entry: GradientHistoryEntry,
  limit: number = GRADIENT_HISTORY_LIMIT
): GradientHistoryEntry[] {
  if (entries.some((existing) => existing.css === entry.css)) {
    return [...entries];
  }
  return [entry, ...entries].slice(0, limit);
}

export function parseGradientTypeFromCss(css: string): GradientType | null {
  const match = css.match(/^(linear|radial|conic)-gradient\((.+)\)$/);
  if (!match) {
    return null;
  }
  return match[1] as GradientType;
}

export function formatRelativeTimestamp(
  timestamp: number,
  now: (() => number) = Date.now
): string {
  const diff = now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

export function titleCaseGradientType(type: string): string {
  if (!type) {
    return '';
  }
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function nextColorStopPosition(lastPosition: number): number {
  return Math.min(100, lastPosition + 10);
}

export function resolveGradientSuggestion(options: {
  type: GradientType;
  stopCount: number;
  hasResult: boolean;
  hasError: boolean;
  historyCount: number;
}): IctToolSuggestion | null {
  const { type, stopCount, hasResult, hasError, historyCount } = options;

  if (hasError) {
    return {
      id: 'gg-min-stops',
      title: 'Need at least two color stops',
      reason:
        'Gradients require two or more stops. Color Picker helps you choose HEX values for new stops.',
      actionLabel: 'Open Color Picker',
      path: '/image-color-tools/color-picker'
    };
  }

  if (stopCount >= 4 && hasResult) {
    return {
      id: 'gg-palette',
      title: 'Many stops — try a palette?',
      reason:
        'With several stops, Palette Generator can suggest harmonious sets you can paste back as stops.',
      actionLabel: 'Open Palette Generator',
      path: '/image-color-tools/palette-generator'
    };
  }

  if (type === 'conic' && hasResult) {
    return {
      id: 'gg-favicon',
      title: 'Using a colorful conic gradient?',
      reason:
        'Favicon Generator can capture a brand mark from bold color sets like rainbow conics.',
      actionLabel: 'Open Favicon Generator',
      path: '/image-color-tools/favicon-generator'
    };
  }

  if (hasResult) {
    return {
      id: 'gg-color-picker',
      title: 'Refine stop colors',
      reason:
        'Color Picker converts between HEX/RGB/HSL when you need precise stop values.',
      actionLabel: 'Open Color Picker',
      path: '/image-color-tools/color-picker'
    };
  }

  if (historyCount > 0) {
    return {
      id: 'gg-history',
      title: 'Reuse a recent gradient',
      reason:
        'History stores CSS snapshots. Apply one, then tweak stops with Color Picker.',
      actionLabel: 'Open Color Picker',
      path: '/image-color-tools/color-picker'
    };
  }

  return {
    id: 'gg-start',
    title: 'Start with a preset',
    reason:
      'Try Sunset or Ocean, then adjust stops. Color Picker helps lock brand HEX values.',
    actionLabel: 'Open Color Picker',
    path: '/image-color-tools/color-picker'
  };
}
