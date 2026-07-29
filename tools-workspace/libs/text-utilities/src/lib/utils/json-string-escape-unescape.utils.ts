import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { jsonEscape, jsonUnescape } from '../shared/text-transform.utils';
import type {
  JsonStringConversionOptions,
  JsonStringConversionResult,
  JsonStringSuggestionContext
} from '../types/json-string-escape-unescape.types';

const JSON_ESCAPE_SEQUENCE_PATTERN = /\\(?:[nrtbf"/\\]|u[0-9a-fA-F]{4})/;

export function convertJsonStringText(
  options: JsonStringConversionOptions
): JsonStringConversionResult {
  const { mode, inputText } = options;
  if (!inputText) {
    return { output: '', errorMessage: '' };
  }

  try {
    if (mode === 'encode') {
      return { output: jsonEscape(inputText), errorMessage: '' };
    }
    return { output: jsonUnescape(inputText), errorMessage: '' };
  } catch (error) {
    return {
      output: '',
      errorMessage: (error as Error).message || 'Processing failed.'
    };
  }
}

/** Heuristic: text already contains common JSON string escape sequences. */
export function inputLooksLikeJsonEscaped(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return false;
  }
  return JSON_ESCAPE_SEQUENCE_PATTERN.test(trimmed);
}

export function resolveJsonStringSuggestion(
  context: JsonStringSuggestionContext
): TuToolSuggestion | null {
  const { mode, hasInput, hasOutput, errorMessage, inputLooksLikeEscaped: looksEscaped } = context;

  if (!hasInput) {
    return {
      id: 'jse-get-started',
      title: 'Escape or unescape a JSON string?',
      reason:
        'Paste plain text to escape for a JSON string body (no outer quotes), or paste escapes like \\n and \\uXXXX to unescape.',
      actionLabel: 'Open JSON Formatter / Validator',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (errorMessage) {
    return {
      id: 'jse-error',
      title: 'Could not unescape JSON string',
      reason:
        errorMessage.includes('Invalid JSON')
          ? 'Invalid or incomplete escape sequences (or bare quotes) were found. Paste the string body without wrapping quotes.'
          : errorMessage,
      actionLabel: 'Open Unicode Escape / Unescape',
      path: '/text-utilities/unicode-escape-unescape'
    };
  }

  if (mode === 'encode' && looksEscaped) {
    return {
      id: 'jse-looks-escaped',
      title: 'Input already looks escaped',
      reason:
        'You are in Escape mode, but this text already contains JSON escape sequences. Switch to Unescape to restore plain text.',
      actionLabel: 'Open JSON Formatter / Validator',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (hasOutput && mode === 'decode') {
    return {
      id: 'jse-unescaped',
      title: 'Unescaped successfully',
      reason:
        'Plain text is ready. Format it as JSON next, or inspect Unicode escapes if you still see \\u sequences.',
      actionLabel: 'Open JSON Formatter / Validator',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (hasOutput && mode === 'encode') {
    return {
      id: 'jse-escaped',
      title: 'Escaped successfully',
      reason:
        'Quotes, newlines, and control characters are JSON-safe. Paste into a JSON document or validate the full payload next.',
      actionLabel: 'Open JSON Formatter / Validator',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  return {
    id: 'jse-ready',
    title: 'Ready to convert',
    reason: 'Keep typing — conversion updates live. Upload a text file when the payload is large.',
    actionLabel: 'Open Unicode Escape / Unescape',
    path: '/text-utilities/unicode-escape-unescape'
  };
}
