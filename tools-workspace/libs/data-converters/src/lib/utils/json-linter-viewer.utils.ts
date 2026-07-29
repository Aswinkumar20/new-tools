import type { DcToolSuggestion } from '../shared/dc-tool-suggestion.model';
import { buildLineNumberList, formatCsvJsonBytes } from '../utils/csv-to-json-json-to-csv.utils';
import {
  looksLikeCsvDocument,
  looksLikeYamlDocument
} from '../utils/json-formatter-beautifier-validator.utils';
import type {
  JsonLinterDiagnostic,
  JsonLinterDiagnosticLevel,
  JsonLinterMetricsSummary,
  JsonLinterParseResult,
  JsonLinterPreviewMode,
  JsonLinterSanitizeOptions,
  JsonLinterSanitizeResult
} from '../types/json-linter-viewer.types';

export { blurActiveElement } from '../utils/csv-to-json-json-to-csv.utils';

export function computeJsonLinterMetrics(
  value: string,
  selection: string
): JsonLinterMetricsSummary {
  return {
    characters: value.length,
    lines: value.split(/\r?\n/).length,
    sizeLabel: formatCsvJsonBytes(new Blob([value]).size),
    selection
  };
}

export function buildJsonLinterLineNumbers(source: string): number[] {
  return buildLineNumberList(source);
}

export function createJsonLinterDiagnosticId(
  createId: () => string = () =>
    `diag-${Date.now()}-${Math.floor(Math.random() * 100000)}`
): string {
  return createId();
}

export function createJsonLinterDiagnostic(
  level: JsonLinterDiagnosticLevel,
  message: string,
  extras?: Partial<JsonLinterDiagnostic>,
  createId?: () => string
): JsonLinterDiagnostic {
  return {
    id: createJsonLinterDiagnosticId(createId),
    level,
    message,
    ...extras
  };
}

export function sanitizeJsonLinterInput(
  source: string,
  options: JsonLinterSanitizeOptions
): JsonLinterSanitizeResult {
  const transformations = new Set<string>();
  const warnings = new Set<string>();
  let result = '';

  let inString = false;
  let stringChar = '"';
  let escaping = false;

  const length = source.length;

  for (let i = 0; i < length; i += 1) {
    const char = source[i];
    const next = i + 1 < length ? source[i + 1] : '';

    if (inString) {
      result += char;
      if (escaping) {
        escaping = false;
      } else if (char === '\\') {
        escaping = true;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      warnings.add('Single-line comments detected.');
      const endOfLine = findJsonLinterLineBreak(source, i + 2);
      if (options.allowComments) {
        transformations.add('Removed single-line comments.');
        i = endOfLine - 1;
        continue;
      }
      result += char;
      continue;
    }

    if (char === '/' && next === '*') {
      warnings.add('Block comments detected.');
      const endOfComment = findJsonLinterBlockCommentEnd(source, i + 2);
      if (options.allowComments) {
        transformations.add('Removed block comments.');
        i = endOfComment;
        continue;
      }
      result += char;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      result += char;
      continue;
    }

    if (char === ',' && isJsonLinterTrailingComma(source, i + 1)) {
      warnings.add('Trailing commas detected.');
      if (options.allowTrailingCommas) {
        transformations.add('Removed trailing commas.');
        continue;
      }
    }

    result += char;
  }

  return {
    text: result,
    transformations: Array.from(transformations),
    warnings: Array.from(warnings)
  };
}

export function isJsonLinterTrailingComma(source: string, start: number): boolean {
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (/\s/.test(char)) {
      continue;
    }
    return char === '}' || char === ']';
  }
  return false;
}

export function findJsonLinterLineBreak(source: string, start: number): number {
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '\n') {
      return i;
    }
  }
  return source.length;
}

export function findJsonLinterBlockCommentEnd(source: string, start: number): number {
  for (let i = start; i < source.length - 1; i += 1) {
    if (source[i] === '*' && source[i + 1] === '/') {
      return i + 1;
    }
  }
  return source.length - 1;
}

export function tryParseJsonLinterInput(
  source: string,
  options: JsonLinterSanitizeOptions,
  createId?: () => string
): JsonLinterParseResult {
  if (!source.trim().length) {
    return {
      success: false,
      diagnostic: createJsonLinterDiagnostic(
        'error',
        'Paste JSON before attempting to format or minify.',
        undefined,
        createId
      )
    };
  }

  const sanitize = sanitizeJsonLinterInput(source, options);

  try {
    const parsed = JSON.parse(sanitize.text);
    return { success: true, value: parsed };
  } catch (error) {
    return {
      success: false,
      diagnostic: createJsonLinterErrorDiagnostic(error, sanitize.text, createId)
    };
  }
}

export function createJsonLinterErrorDiagnostic(
  error: unknown,
  source: string,
  createId?: () => string
): JsonLinterDiagnostic {
  const message = error instanceof Error ? error.message : 'Unknown JSON parsing error.';
  const errorPosition = extractJsonLinterErrorPosition(error);

  if (errorPosition === null) {
    return createJsonLinterDiagnostic('error', message, undefined, createId);
  }

  const { line, column } = computeJsonLinterLineAndColumn(source, errorPosition);
  const snippet = extractJsonLinterSnippet(source, line);

  return createJsonLinterDiagnostic(
    'error',
    message,
    {
      line,
      column,
      snippet
    },
    createId
  );
}

export function extractJsonLinterErrorPosition(error: unknown): number | null {
  if (!(error instanceof Error)) {
    return null;
  }
  const matches = error.message.match(/position\s+(\d+)/i);
  if (matches && matches[1]) {
    return Number.parseInt(matches[1], 10);
  }
  return null;
}

export function computeJsonLinterLineAndColumn(
  source: string,
  position: number
): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < source.length && i < position; i += 1) {
    if (source[i] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

export function extractJsonLinterSnippet(source: string, line: number): string {
  const lines = source.split(/\r?\n/);
  if (line - 1 < 0 || line - 1 >= lines.length) {
    return '';
  }
  return lines[line - 1].trim();
}

export function sortJsonLinterValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonLinterValue(item));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => [key, sortJsonLinterValue(val)] as [string, unknown])
      .sort((a, b) => a[0].localeCompare(b[0]));
    const sorted: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      sorted[key] = val;
    }
    return sorted;
  }
  return value;
}

export function prepareJsonLinterResult(
  value: unknown,
  options: {
    sortKeys: boolean;
    previewMode: JsonLinterPreviewMode;
    indentSize: number;
  }
): string {
  const sorted = options.sortKeys ? sortJsonLinterValue(value) : value;
  if (options.previewMode === 'minified') {
    return JSON.stringify(sorted);
  }
  return JSON.stringify(sorted, null, options.indentSize);
}

export function isSupportedJsonLinterFile(file: File): boolean {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith('.json') || file.type.includes('json');
}

export function resolveJsonLinterSuggestion(options: {
  source: string;
  hasOutput: boolean;
  lintStatus: 'idle' | 'success' | 'error';
  allowComments: boolean;
  allowTrailingCommas: boolean;
}): DcToolSuggestion | null {
  const trimmed = options.source.trim();

  if (!trimmed) {
    return {
      id: 'jlv-empty',
      title: 'Start with a sample or import data',
      reason: 'Empty input often means the payload still lives in CSV, YAML, or a spreadsheet.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (looksLikeYamlDocument(trimmed)) {
    return {
      id: 'jlv-yaml',
      title: 'This looks like YAML',
      reason: 'YAML documents need conversion before JSON linting will succeed.',
      actionLabel: 'Open YAML ⇄ JSON',
      path: '/data-converters/yaml-to-json-json-to-yaml'
    };
  }

  if (looksLikeCsvDocument(trimmed)) {
    return {
      id: 'jlv-csv',
      title: 'This looks like CSV',
      reason: 'CSV rows cannot be linted as JSON until they are converted.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (options.lintStatus === 'error') {
    const hasComments = /\/\/|\/\*/.test(trimmed);
    const hasTrailingComma = /,(\s*[}\]])/.test(trimmed);

    if ((hasComments && !options.allowComments) || (hasTrailingComma && !options.allowTrailingCommas)) {
      return {
        id: 'jlv-sanitize',
        title: 'Enable clean-up options?',
        reason:
          'Comments or trailing commas may be breaking strict JSON. Turn on Strip comments / Trailing commas in Options, then validate again.',
        actionLabel: 'Open JSON Formatter',
        path: '/data-converters/json-formatter-beautifier-validator'
      };
    }

    return {
      id: 'jlv-formatter',
      title: 'Try the JSON Formatter?',
      reason: 'Auto-fix and a tree view can help repair or inspect stubborn syntax issues.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (options.lintStatus === 'success' && options.hasOutput) {
    return {
      id: 'jlv-format-explore',
      title: 'Explore this JSON further?',
      reason: 'The formatter adds beautify shortcuts and a collapsible tree for large payloads.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  return null;
}
