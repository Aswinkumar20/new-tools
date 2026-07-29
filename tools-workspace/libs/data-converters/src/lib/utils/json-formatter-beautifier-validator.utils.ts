import type { DcToolSuggestion } from '../shared/dc-tool-suggestion.model';
import { buildLineNumberList, formatCsvJsonBytes } from '../utils/csv-to-json-json-to-csv.utils';
import type {
  JsonFormatterIndentStyle,
  JsonFormatterInputMetrics,
  JsonFormatterValidationResult,
  JsonSafeParseResult,
  JsonTreeNode
} from '../types/json-formatter-beautifier-validator.types';

export function createJsonFormatterDefaultSampleText(sample: object): string {
  return JSON.stringify(sample, null, 2);
}

export function computeJsonInputMetrics(source: string): JsonFormatterInputMetrics {
  return {
    characters: source.length,
    lines: source.split(/\r?\n/).length,
    sizeLabel: formatCsvJsonBytes(new Blob([source]).size)
  };
}

export function buildJsonLineNumberList(source: string): number[] {
  return buildLineNumberList(source);
}

export function resolveJsonStringifyIndent(
  indentSize: number,
  indentStyle: JsonFormatterIndentStyle
): string {
  return indentStyle === 'tabs' ? '\t' : new Array(indentSize).fill(' ').join('');
}

export function safeParseJson(source: string): JsonSafeParseResult {
  try {
    return { success: true, value: JSON.parse(source) };
  } catch (error) {
    return { success: false, error: buildJsonParseError(error, source) };
  }
}

export function buildJsonParseError(
  error: unknown,
  source: string
): JsonFormatterValidationResult {
  const message = error instanceof Error ? error.message : 'Unknown parsing error.';
  let position: number | undefined;

  const match = /position (\d+)/i.exec(message);
  if (match) {
    position = Number.parseInt(match[1], 10);
  }

  if (position === undefined) {
    const unexpectedMatch = /column (\d+)/i.exec(message);
    if (unexpectedMatch) {
      position = Number.parseInt(unexpectedMatch[1], 10);
    }
  }

  if (position === undefined) {
    return {
      status: 'error',
      message
    };
  }

  const { line, column } = calculateJsonLineAndColumn(source, position);
  const excerpt = buildJsonExcerpt(source, line, column);

  return {
    status: 'error',
    message,
    line,
    column,
    excerpt
  };
}

export function calculateJsonLineAndColumn(
  source: string,
  position: number
): { line: number; column: number } {
  const snippet = source.slice(0, position);
  const segments = snippet.split(/\r?\n/);
  const line = segments.length;
  const column = (segments[segments.length - 1] || '').length + 1;
  return { line, column };
}

export function buildJsonExcerpt(source: string, line: number, column: number): string {
  const lines = source.split(/\r?\n/);
  const target = lines[line - 1] ?? '';
  const caretLine = `${' '.repeat(Math.max(column - 1, 0))}^`;
  return `${target}\n${caretLine}`;
}

/** Legacy auto-fix: strip trailing commas, swap single quotes, then parse. */
export function tryAutoFixJsonSource(
  source: string
): { ok: true; value: unknown } | { ok: false; error: JsonFormatterValidationResult } {
  const fixedInput = source.replace(/,(\s*[}\]])/g, '$1').replace(/'/g, '"');
  const parsed = safeParseJson(fixedInput);
  if (parsed.success) {
    return { ok: true, value: parsed.value };
  }
  return { ok: false, error: parsed.error };
}

export function generateJsonTreeNodes(
  value: unknown,
  level = 0,
  key?: string,
  createId: () => string = () => Math.random().toString(36).slice(2, 8)
): JsonTreeNode[] {
  const type = resolveJsonTreeType(value);
  const id = `${level}-${key ?? 'root'}-${createId()}`;
  const isExpandable = type === 'object' || type === 'array';

  const node: JsonTreeNode = {
    id,
    level,
    key,
    type,
    preview: buildJsonTreePreview(value),
    metadata: buildJsonTreeMetadata(value),
    expanded: level < 1
  };

  if (isExpandable) {
    node.children = [];
    if (type === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      node.children = entries.flatMap(([childKey, childValue]) =>
        generateJsonTreeNodes(childValue, level + 1, childKey, createId)
      );
    } else {
      const arrayValue = value as unknown[];
      node.children = arrayValue.flatMap((item, index) =>
        generateJsonTreeNodes(item, level + 1, `[${index}]`, createId)
      );
    }
  }

  return [node];
}

export function buildJsonTreePreview(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `Array (${value.length})`;
  }
  if (typeof value === 'object') {
    const length = Object.keys(value as Record<string, unknown>).length;
    return `Object (${length})`;
  }
  if (typeof value === 'string') {
    const trimmed = value.length > 60 ? `${value.slice(0, 57)}...` : value;
    return `"${trimmed}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value === undefined) {
    return 'undefined';
  }
  return '';
}

export function buildJsonTreeMetadata(value: unknown): string | undefined {
  if (value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? 'Empty array' : undefined;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length === 0 ? 'Empty object' : undefined;
  }
  if (typeof value === 'string') {
    return `${value.length} characters`;
  }
  return undefined;
}

export function resolveJsonTreeType(value: unknown): JsonTreeNode['type'] {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'object') {
    return 'object';
  }
  if (typeof value === 'string') {
    return 'string';
  }
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  return 'string';
}

export function hasJsonTrailingComma(source: string): boolean {
  return /,(\s*[}\]])/.test(source);
}

export function hasJsonSingleQuotes(source: string): boolean {
  return /'/.test(source);
}

export function looksLikeYamlDocument(source: string): boolean {
  const trimmed = source.trim();
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return false;
  }
  return (
    /^---\s*$/m.test(trimmed) ||
    /^[\w.-]+\s*:\s*.+$/m.test(trimmed) ||
    /^\s*-\s+\S+/m.test(trimmed)
  );
}

export function looksLikeCsvDocument(source: string): boolean {
  const trimmed = source.trim();
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return false;
  }
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return false;
  }
  const commas = (lines[0].match(/,/g) ?? []).length;
  return commas > 0 && lines.slice(1, 4).every((line) => (line.match(/,/g) ?? []).length === commas);
}

export function resolveJsonFormatterSuggestion(options: {
  source: string;
  hasOutput: boolean;
  validationStatus: 'success' | 'error' | null;
}): DcToolSuggestion | null {
  const trimmed = options.source.trim();

  if (!trimmed) {
    return {
      id: 'jfv-empty',
      title: 'Start with a sample or import data',
      reason: 'Empty input often means the payload still lives in CSV or a spreadsheet.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (looksLikeYamlDocument(trimmed)) {
    return {
      id: 'jfv-yaml',
      title: 'This looks like YAML',
      reason: 'YAML documents are not valid JSON — convert first, then format here.',
      actionLabel: 'Open YAML ⇄ JSON',
      path: '/data-converters/yaml-to-json-json-to-yaml'
    };
  }

  if (looksLikeCsvDocument(trimmed)) {
    return {
      id: 'jfv-csv',
      title: 'This looks like CSV',
      reason: 'CSV rows cannot be beautified as JSON until they are converted.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (options.validationStatus === 'error') {
    if (hasJsonTrailingComma(trimmed) || hasJsonSingleQuotes(trimmed)) {
      return {
        id: 'jfv-autofix',
        title: 'Common JSON mistakes detected',
        reason: 'Trailing commas or single quotes often break strict JSON. Use Fix (Ctrl+F), or lint for deeper diagnostics.',
        actionLabel: 'Open JSON Linter',
        path: '/data-converters/json-linter-viewer'
      };
    }

    return {
      id: 'jfv-lint',
      title: 'Need deeper diagnostics?',
      reason: 'Validation failed. The JSON Linter Viewer can help inspect nested issues.',
      actionLabel: 'Open JSON Linter',
      path: '/data-converters/json-linter-viewer'
    };
  }

  if (options.validationStatus === 'success' && options.hasOutput && looksLikeJsonObjectArray(trimmed)) {
    return {
      id: 'jfv-export-csv',
      title: 'Export this JSON as CSV?',
      reason: 'Formatted object lists convert cleanly to spreadsheet-friendly rows.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  return null;
}

function looksLikeJsonObjectArray(source: string): boolean {
  try {
    const parsed = JSON.parse(source) as unknown;
    return (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      typeof parsed[0] === 'object' &&
      parsed[0] !== null &&
      !Array.isArray(parsed[0])
    );
  } catch {
    return false;
  }
}
