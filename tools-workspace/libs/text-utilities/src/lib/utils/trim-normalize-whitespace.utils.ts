import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { trimNormalize } from '../shared/text-transform.utils';
import type {
  TrimNormalizeConversionOptions,
  TrimNormalizeConversionResult,
  TrimNormalizeSuggestionContext,
} from '../types/trim-normalize-whitespace.types';

export function countActiveTrimNormalizeOptions(
  options: Pick<
    TrimNormalizeSuggestionContext,
    'trimLines' | 'collapseSpaces' | 'removeEmptyLines' | 'normalizeLineEndings'
  >
): number {
  return [
    options.trimLines,
    options.collapseSpaces,
    options.removeEmptyLines,
    options.normalizeLineEndings,
  ].filter(Boolean).length;
}

export function convertTrimNormalizeText(
  options: TrimNormalizeConversionOptions
): TrimNormalizeConversionResult {
  return {
    output: trimNormalize(options.inputText, {
      trimLines: options.trimLines,
      collapseSpaces: options.collapseSpaces,
      removeEmptyLines: options.removeEmptyLines,
      normalizeLineEndings: options.normalizeLineEndings,
    }),
  };
}

export function inputHasLineEdgeWhitespace(text: string): boolean {
  if (!text) return false;
  return text.split(/\r?\n|\r/).some((line) => line !== line.trim());
}

export function inputHasCollapsedWhitespaceRuns(text: string): boolean {
  // Interior runs only — leading/trailing doubles are handled by Trim lines.
  return /\S[^\S\r\n]{2,}\S/.test(text);
}

export function inputHasEmptyLines(text: string): boolean {
  if (!text) return false;
  return text.split(/\r?\n|\r/).some((line) => line.trim().length === 0);
}

export function inputHasNonLfLineEndings(text: string): boolean {
  return /\r\n|\r/.test(text);
}

export function resolveTrimNormalizeSuggestion(
  context: TrimNormalizeSuggestionContext
): TuToolSuggestion | null {
  const {
    hasInput,
    hasOutput,
    outputUnchanged,
    trimLines,
    collapseSpaces,
    removeEmptyLines,
    normalizeLineEndings,
    hasLineEdgeWhitespace,
    hasCollapsedWhitespaceRuns,
    hasEmptyLines,
    hasNonLfLineEndings,
    activeOptionCount,
  } = context;

  if (!hasInput) {
    return {
      id: 'tnw-get-started',
      title: 'Clean messy whitespace?',
      reason:
        'Paste text from docs or the web. Trim lines is on by default — open Options to collapse spaces, drop empty lines, or normalize CRLF.',
      actionLabel: 'Open Invisible Character Detector',
      path: '/text-utilities/invisible-character-detector',
    };
  }

  if (activeOptionCount === 0) {
    return {
      id: 'tnw-no-options',
      title: 'No cleanup options enabled',
      reason:
        'Turn on at least one option (trim, collapse, empty lines, or line endings) so the output can change.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace',
    };
  }

  if (hasNonLfLineEndings && !normalizeLineEndings) {
    return {
      id: 'tnw-crlf',
      title: 'Windows/Mac classic line endings detected',
      reason:
        'CRLF or CR found. Enable Normalize line endings to convert them to LF for consistent diffs and tools.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace',
    };
  }

  if (hasEmptyLines && !removeEmptyLines) {
    return {
      id: 'tnw-empty-lines',
      title: 'Blank lines present',
      reason:
        'Enable Remove empty lines to drop blank rows, or keep them if you need paragraph spacing.',
      actionLabel: 'Open Remove Duplicate Lines',
      path: '/text-utilities/remove-duplicate-lines',
    };
  }

  if (hasCollapsedWhitespaceRuns && !collapseSpaces) {
    return {
      id: 'tnw-multi-spaces',
      title: 'Runs of spaces detected',
      reason:
        'Enable Collapse spaces to turn consecutive whitespace into a single space on each line.',
      actionLabel: 'Open Invisible Character Detector',
      path: '/text-utilities/invisible-character-detector',
    };
  }

  if (hasLineEdgeWhitespace && !trimLines) {
    return {
      id: 'tnw-edge-spaces',
      title: 'Leading or trailing spaces on lines',
      reason:
        'Enable Trim lines to strip whitespace from the start and end of each line.',
      actionLabel: 'Open Sort Lines',
      path: '/text-utilities/sort-lines',
    };
  }

  if (hasOutput && outputUnchanged) {
    return {
      id: 'tnw-already-clean',
      title: 'Output matches input',
      reason:
        'With the current options, nothing changed. Try additional options, or check for invisible characters.',
      actionLabel: 'Open Invisible Character Detector',
      path: '/text-utilities/invisible-character-detector',
    };
  }

  if (hasOutput) {
    return {
      id: 'tnw-cleaned',
      title: 'Whitespace cleaned',
      reason:
        'Copy or download the result, use → In to keep editing, or sort / dedupe the cleaned lines next.',
      actionLabel: 'Open Sort Lines',
      path: '/text-utilities/sort-lines',
    };
  }

  return {
    id: 'tnw-ready',
    title: 'Ready to normalize',
    reason:
      'Options apply live as you type. Combine trim + collapse for pasted content from documents.',
    actionLabel: 'Open Find and Replace',
    path: '/text-utilities/find-and-replace',
  };
}
