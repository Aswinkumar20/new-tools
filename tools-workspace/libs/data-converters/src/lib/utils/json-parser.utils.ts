import type { DcToolSuggestion } from '../shared/dc-tool-suggestion.model';
import { buildLineNumberList, formatCsvJsonBytes } from '../utils/csv-to-json-json-to-csv.utils';
import {
  looksLikeCsvDocument,
  looksLikeYamlDocument
} from '../utils/json-formatter-beautifier-validator.utils';
import type {
  JsonParserDiagnostic,
  JsonParserMetricsSummary,
  JsonParserNodeType,
  JsonParserParseResult,
  JsonParserParseState,
  JsonParserParseStatus,
  JsonParserPreviewMode,
  JsonParserTreeNode
} from '../types/json-parser.types';

export { blurActiveElement } from '../utils/csv-to-json-json-to-csv.utils';

export function computeJsonParserMetrics(value: string): JsonParserMetricsSummary {
  return {
    characters: value.length,
    lines: value.split(/\r?\n/).length,
    sizeLabel: formatCsvJsonBytes(new Blob([value]).size)
  };
}

export function buildJsonParserLineNumbers(source: string): number[] {
  return buildLineNumberList(source);
}

export function createJsonParserIdleStringifyStatus(): JsonParserParseStatus {
  return {
    status: 'idle',
    message: 'Provide JSON to stringify into a single-line representation.'
  };
}

export function createJsonParserIdleStringLiteralStatus(): JsonParserParseStatus {
  return {
    status: 'idle',
    message: 'Paste a stringified JSON value to convert it back to readable JSON.'
  };
}

export function createJsonParserDiagnosticId(
  createId: () => string = () =>
    `diag-${Date.now()}-${Math.floor(Math.random() * 100000)}`
): string {
  return createId();
}

export function createJsonParserDiagnostic(
  message: string,
  extras?: Partial<JsonParserDiagnostic>,
  createId?: () => string
): JsonParserDiagnostic {
  return {
    id: createJsonParserDiagnosticId(createId),
    message,
    ...extras
  };
}

export function tryParseJsonParserInput(source: string): JsonParserParseResult {
  if (!source.trim()) {
    return {
      success: false,
      diagnostic: createJsonParserDiagnostic('Paste JSON before formatting or minifying.')
    };
  }
  try {
    return { success: true, value: JSON.parse(source) };
  } catch (error) {
    return {
      success: false,
      diagnostic: createJsonParserErrorDiagnostic(error, source)
    };
  }
}

export function createJsonParserErrorDiagnostic(
  error: unknown,
  source: string
): JsonParserDiagnostic {
  const message = error instanceof Error ? error.message : 'Unknown JSON parsing error.';
  const position = extractJsonParserErrorPosition(message);
  if (position === null) {
    return createJsonParserDiagnostic(message);
  }
  const { line, column } = computeJsonParserLineAndColumn(source, position);
  const snippet = getJsonParserSnippet(source, line);
  return createJsonParserDiagnostic(message, { line, column, snippet });
}

export function extractJsonParserErrorPosition(message: string): number | null {
  const match = message.match(/position\s+(\d+)/i);
  if (match && match[1]) {
    return Number.parseInt(match[1], 10);
  }
  return null;
}

export function computeJsonParserLineAndColumn(
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

export function getJsonParserSnippet(source: string, line: number): string {
  const lines = source.split(/\r?\n/);
  return lines[line - 1]?.trim() ?? '';
}

export function buildJsonParserTree(
  value: unknown,
  path: string,
  level: number,
  key?: string,
  createId: () => string = () => Math.random().toString(36).slice(2, 8)
): JsonParserTreeNode[] {
  const node = createJsonParserTreeNode(value, path, level, key, createId);
  if (value !== null && typeof value === 'object') {
    const entries = Array.isArray(value) ? value.entries() : Object.entries(value);
    node.children = [];
    for (const [childKey, childValue] of entries as Iterable<[string | number, unknown]>) {
      const childPath = Array.isArray(value) ? `${path}[${childKey}]` : `${path}.${childKey}`;
      const childNodes = buildJsonParserTree(
        childValue,
        childPath,
        level + 1,
        String(childKey),
        createId
      );
      node.children.push(...childNodes);
    }
    node.expanded = level < 1;
  }
  return [node];
}

export function createJsonParserTreeNode(
  value: unknown,
  path: string,
  level: number,
  key: string | undefined,
  createId: () => string
): JsonParserTreeNode {
  const type = resolveJsonParserNodeType(value);
  return {
    id: `${path}-${level}-${createId()}`,
    key,
    type,
    level,
    path,
    expanded: level < 1,
    preview: createJsonParserPreview(value, type)
  };
}

export function createJsonParserPreview(value: unknown, type: JsonParserNodeType): string {
  if (type === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return `Object {${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''}}`;
  }
  if (type === 'array') {
    const length = (value as unknown[]).length;
    return `Array(${length})`;
  }
  if (type === 'string') {
    const text = String(value);
    return text.length > 40 ? `${text.slice(0, 37)}…` : text;
  }
  return String(value);
}

export function resolveJsonParserNodeType(value: unknown): JsonParserNodeType {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  switch (typeof value) {
    case 'object':
      return 'object';
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'string';
  }
}

export function flattenJsonParserTree(nodes: JsonParserTreeNode[]): JsonParserTreeNode[] {
  const result: JsonParserTreeNode[] = [];
  const stack = [...nodes];
  while (stack.length) {
    const node = stack.shift()!;
    result.push(node);
    if (node.children) {
      stack.unshift(...node.children);
    }
  }
  return result;
}

export function filterJsonParserTree(
  treeNodes: JsonParserTreeNode[],
  term: string
): JsonParserTreeNode[] {
  if (!term.trim()) {
    return treeNodes;
  }

  const matches = new Set(
    flattenJsonParserTree(treeNodes)
      .filter(
        (node) =>
          (node.key && node.key.toLowerCase().includes(term.toLowerCase())) ||
          node.preview.toLowerCase().includes(term.toLowerCase()) ||
          node.path.toLowerCase().includes(term.toLowerCase())
      )
      .map((node) => node.path)
  );

  const filterRecursive = (nodes: JsonParserTreeNode[]): JsonParserTreeNode[] =>
    nodes
      .map((node) => {
        const children = node.children ? filterRecursive(node.children) : undefined;
        const includeNode = matches.has(node.path) || (children && children.length > 0);
        if (!includeNode) {
          return null;
        }
        return {
          ...node,
          expanded: true,
          children
        } as JsonParserTreeNode;
      })
      .filter((node): node is JsonParserTreeNode => node !== null);

  return filterRecursive(treeNodes);
}

export function resolveJsonParserPathValue(value: unknown, path: string): unknown {
  if (path === '$') {
    return value;
  }
  const segments = path
    .replace(/\$\.?/, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((segment) => segment.length);

  return segments.reduce((current: unknown, segment) => {
    if (current == null) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, value);
}

export function formatJsonParserPreviewOutput(
  value: unknown,
  previewMode: JsonParserPreviewMode
): string {
  return previewMode === 'formatted'
    ? JSON.stringify(value, null, 2)
    : JSON.stringify(value);
}

export function formatJsonParserParsedValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

export function resolveJsonParserSuggestion(options: {
  source: string;
  hasTree: boolean;
  parseStatus: JsonParserParseState;
}): DcToolSuggestion | null {
  const trimmed = options.source.trim();

  if (!trimmed) {
    return {
      id: 'jp-empty',
      title: 'Start with a sample or import data',
      reason: 'Empty input often means the payload still lives in CSV, YAML, or a spreadsheet.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (looksLikeYamlDocument(trimmed)) {
    return {
      id: 'jp-yaml',
      title: 'This looks like YAML',
      reason: 'YAML documents need conversion before JSON parsing will succeed.',
      actionLabel: 'Open YAML ⇄ JSON',
      path: '/data-converters/yaml-to-json-json-to-yaml'
    };
  }

  if (looksLikeCsvDocument(trimmed)) {
    return {
      id: 'jp-csv',
      title: 'This looks like CSV',
      reason: 'CSV rows cannot be explored as a JSON tree until they are converted.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (options.parseStatus === 'error') {
    return {
      id: 'jp-lint',
      title: 'Need lint diagnostics?',
      reason: 'The JSON Linter Viewer can surface comments, trailing commas, and cleanup options.',
      actionLabel: 'Open JSON Linter',
      path: '/data-converters/json-linter-viewer'
    };
  }

  if (options.parseStatus === 'success' && options.hasTree) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        typeof parsed[0] === 'object' &&
        parsed[0] !== null &&
        !Array.isArray(parsed[0])
      ) {
        return {
          id: 'jp-export-csv',
          title: 'Export this array as CSV?',
          reason: 'Parsed object lists convert cleanly to spreadsheet-friendly rows.',
          actionLabel: 'Open CSV ⇄ JSON',
          path: '/data-converters/csv-to-json-json-to-csv'
        };
      }
    } catch {
      // fall through to formatter suggestion
    }

    return {
      id: 'jp-format',
      title: 'Beautify or validate further?',
      reason: 'The JSON Formatter adds beautify shortcuts and dedicated validation feedback.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  return null;
}
