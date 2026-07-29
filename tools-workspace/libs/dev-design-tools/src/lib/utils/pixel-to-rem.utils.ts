import type { DdToolSuggestion } from '../shared/dd-tool-suggestion.model';
import { PIXEL_REM_HISTORY_LIMIT } from '../constants/pixel-to-rem.constants';
import type {
  PixelRemConversionResult,
  PixelRemDirection,
  PixelRemFormValues,
  PixelRemHistoryEntry
} from '../types/pixel-to-rem.types';

export function calculatePixelRemConversion(values: PixelRemFormValues): PixelRemConversionResult | null {
  const { direction, inputValue, baseSize } = values;

  if (inputValue === null || inputValue === undefined || Number.isNaN(inputValue) || baseSize <= 0) {
    return null;
  }

  let output: number;
  let formula: string;

  if (direction === 'px-to-rem') {
    output = inputValue / baseSize;
    formula = `${inputValue}px ÷ ${baseSize}px = ${output.toFixed(4)}rem`;
  } else {
    output = inputValue * baseSize;
    formula = `${inputValue}rem × ${baseSize}px = ${output.toFixed(2)}px`;
  }

  return {
    input: inputValue,
    output,
    formula
  };
}

export function formatPixelRemOutput(value: number, direction: PixelRemDirection): string {
  if (value % 1 === 0) {
    return value.toString();
  }
  if (direction === 'px-to-rem') {
    return value.toFixed(4).replace(/\.?0+$/, '');
  }
  return value.toFixed(2).replace(/\.?0+$/, '');
}

export function pxToRem(px: number, baseSize: number): number {
  const base = baseSize || 16;
  return px / base;
}

export function validatePixelRemInputs(options: {
  inputValid: boolean;
  baseValid: boolean;
}): string[] {
  const issues: string[] = [];
  if (!options.baseValid) {
    issues.push('Base font size must be between 1 and 100.');
  }
  if (!options.inputValid) {
    issues.push('Input value must be 0 or greater.');
  }
  return issues;
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

export function prependPixelRemHistory(
  entries: PixelRemHistoryEntry[],
  entry: PixelRemHistoryEntry,
  limit = PIXEL_REM_HISTORY_LIMIT
): PixelRemHistoryEntry[] {
  const exists = entries.some(
    (existing) =>
      existing.input === entry.input &&
      existing.direction === entry.direction &&
      existing.baseSize === entry.baseSize
  );
  if (exists) {
    return entries;
  }
  return [entry, ...entries].slice(0, limit);
}

export function resolvePixelRemSuggestion(options: {
  values: PixelRemFormValues;
  hasResult: boolean;
  hasCopiedResult: boolean;
}): DdToolSuggestion | null {
  const { values, hasResult, hasCopiedResult } = options;
  if (!hasResult) {
    return null;
  }

  if (values.baseSize !== 16) {
    return {
      id: 'ptr-radius',
      title: 'Apply rem values to border-radius?',
      reason: `Your base is ${values.baseSize}px. Border Radius Preview can use rem units with the same root size.`,
      actionLabel: 'Open Border Radius Preview',
      path: '/dev-design-tools/border-radius-preview'
    };
  }

  if (hasCopiedResult) {
    return {
      id: 'ptr-shadow',
      title: 'Convert shadow offsets next?',
      reason: 'Copied rem/px values often pair with elevation. Generate a matching box shadow.',
      actionLabel: 'Open Box Shadow Generator',
      path: '/dev-design-tools/box-shadow-generator'
    };
  }

  if (values.direction === 'px-to-rem' && values.inputValue === 16 && values.baseSize === 16) {
    return null;
  }

  if (values.direction === 'rem-to-px') {
    return {
      id: 'ptr-gradient',
      title: 'Style a rem-based surface?',
      reason: 'You are working in rem. Gradients help fill cards sized with rem spacing tokens.',
      actionLabel: 'Open CSS Gradient Generator',
      path: '/dev-design-tools/css-gradient-generator'
    };
  }

  return null;
}
