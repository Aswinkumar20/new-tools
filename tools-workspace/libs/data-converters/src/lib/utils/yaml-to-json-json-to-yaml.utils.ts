import type { DcToolSuggestion } from '../shared/dc-tool-suggestion.model';
import { buildLineNumberList, formatCsvJsonBytes } from '../utils/csv-to-json-json-to-csv.utils';
import {
  looksLikeCsvDocument,
  looksLikeYamlDocument
} from '../utils/json-formatter-beautifier-validator.utils';
import type {
  YamlJsonConversionMode,
  YamlJsonMetricsSummary,
  YamlJsonStringifyOptions
} from '../types/yaml-to-json-json-to-yaml.types';

export { blurActiveElement } from '../utils/csv-to-json-json-to-csv.utils';

export function computeYamlJsonMetrics(
  value: string,
  selection: string
): YamlJsonMetricsSummary {
  return {
    lines: value.split(/\r?\n/).length,
    sizeLabel: formatCsvJsonBytes(new Blob([value]).size),
    selection
  };
}

export function buildYamlJsonLineNumbers(source: string): number[] {
  return buildLineNumberList(source);
}

export function looksLikeJsonDocument(source: string): boolean {
  const trimmed = source.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

export function resolveYamlJsonSuggestion(options: {
  mode: YamlJsonConversionMode;
  yamlInput: string;
  jsonInput: string;
  hasOutput: boolean;
  status: 'idle' | 'success' | 'error';
}): DcToolSuggestion | null {
  const source = options.mode === 'yaml-to-json' ? options.yamlInput : options.jsonInput;
  const trimmed = source.trim();

  if (!trimmed) {
    return {
      id: 'yj-empty',
      title: 'Start with a sample or import data',
      reason: 'Empty input often means the payload still lives in CSV or a spreadsheet.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (options.mode === 'yaml-to-json' && looksLikeJsonDocument(trimmed) && !looksLikeYamlDocument(trimmed)) {
    return {
      id: 'yj-switch-json',
      title: 'This looks like JSON',
      reason: 'Switch to JSON → YAML to produce readable configuration output.',
      actionLabel: 'Use JSON → YAML mode',
      path: '/data-converters/yaml-to-json-json-to-yaml'
    };
  }

  if (options.mode === 'json-to-yaml' && looksLikeYamlDocument(trimmed) && !looksLikeJsonDocument(trimmed)) {
    return {
      id: 'yj-switch-yaml',
      title: 'This looks like YAML',
      reason: 'Switch to YAML → JSON to convert configuration into API-friendly JSON.',
      actionLabel: 'Use YAML → JSON mode',
      path: '/data-converters/yaml-to-json-json-to-yaml'
    };
  }

  if (options.mode === 'yaml-to-json' && looksLikeCsvDocument(trimmed)) {
    return {
      id: 'yj-csv',
      title: 'This looks like CSV',
      reason: 'CSV rows convert more cleanly through CSV ⇄ JSON before YAML workflows.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (options.status === 'success' && options.hasOutput && options.mode === 'yaml-to-json') {
    return {
      id: 'yj-format',
      title: 'Beautify or explore this JSON?',
      reason: 'The JSON Formatter adds tree view and validation for converted payloads.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (options.status === 'success' && options.hasOutput && options.mode === 'json-to-yaml') {
    return {
      id: 'yj-lint',
      title: 'Validate the source JSON first?',
      reason: 'If you need to revisit the JSON structure, the linter offers cleanup diagnostics.',
      actionLabel: 'Open JSON Linter',
      path: '/data-converters/json-linter-viewer'
    };
  }

  if (options.status === 'error' && options.mode === 'json-to-yaml') {
    return {
      id: 'yj-error-format',
      title: 'Fix JSON syntax first',
      reason: 'Invalid JSON cannot become YAML. Use the formatter or linter to repair the payload.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  return null;
}

export function parseYamlDocument(source: string): unknown {
  const sanitized = source
    .replace(/\t/g, '  ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, ''));

  const lines: Array<{ indent: number; content: string }> = [];
  sanitized.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    const indent = line.length - line.trimStart().length;
    lines.push({ indent, content: trimmed });
  });

  if (!lines.length) {
    return {};
  }

  const { value, nextIndex } = parseYamlBlock(lines, 0, lines[0].indent);
  if (nextIndex < lines.length) {
    throw new Error('Unable to parse YAML: unexpected indentation or syntax near the end.');
  }
  return value;
}

export function parseYamlBlock(
  lines: Array<{ indent: number; content: string }>,
  startIndex: number,
  currentIndent: number
): { value: unknown; nextIndex: number } {
  if (startIndex >= lines.length) {
    return { value: {}, nextIndex: startIndex };
  }

  const firstLine = lines[startIndex];
  const isArrayMode = firstLine.content.startsWith('- ');
  if (isArrayMode) {
    const items: unknown[] = [];
    let index = startIndex;
    while (index < lines.length) {
      const line = lines[index];
      if (line.indent < currentIndent || !line.content.startsWith('- ')) {
        break;
      }
      const content = line.content.slice(2).trim();
      if (!content) {
        const nested = parseYamlBlock(lines, index + 1, line.indent + 2);
        items.push(nested.value);
        index = nested.nextIndex;
      } else if (content.includes(':')) {
        const colonIndex = content.indexOf(':');
        const key = normalizeKey(content.slice(0, colonIndex).trim());
        const remainder = content.slice(colonIndex + 1).trim();
        const entry: Record<string, unknown> = {};
        if (remainder) {
          entry[key] = parseScalar(remainder);
        }

        let nextIndex = index + 1;
        if (nextIndex < lines.length && lines[nextIndex].indent > line.indent) {
          const nested = parseYamlBlock(lines, nextIndex, line.indent + 2);
          if (nested.value && typeof nested.value === 'object' && !Array.isArray(nested.value)) {
            Object.assign(entry, nested.value as Record<string, unknown>);
          } else if (!remainder) {
            entry[key] = nested.value;
          }
          nextIndex = nested.nextIndex;
        }

        items.push(entry);
        index = nextIndex;
      } else {
        items.push(parseScalar(content));
        index += 1;
      }
    }
    return { value: items, nextIndex: index };
  }

  const result: Record<string, unknown> = {};
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (line.indent < currentIndent || line.content.startsWith('- ')) {
      break;
    }
    const colonIndex = line.content.indexOf(':');
    if (colonIndex === -1) {
      throw new Error(`Invalid YAML syntax near "${line.content}". Expected a key-value pair.`);
    }

    const key = normalizeKey(line.content.slice(0, colonIndex).trim());
    const remainder = line.content.slice(colonIndex + 1).trim();

    if (remainder) {
      result[key] = parseScalar(remainder);
      index += 1;
    } else {
      const nestedIndent = line.indent + 2;
      const nested = parseYamlBlock(lines, index + 1, nestedIndent);
      result[key] = nested.value;
      index = nested.nextIndex;
    }
  }

  return { value: result, nextIndex: index };
}

export function parseScalar(input: string): unknown {
  if (!input) {
    return '';
  }

  const lower = input.toLowerCase();
  if (lower === 'true') {
    return true;
  }
  if (lower === 'false') {
    return false;
  }
  if (lower === 'null' || lower === '~') {
    return null;
  }

  if (/^[+-]?\d+(\.\d+)?$/.test(input)) {
    const num = Number(input);
    if (!Number.isNaN(num)) {
      return num;
    }
  }

  if ((input.startsWith('"') && input.endsWith('"')) || (input.startsWith("'") && input.endsWith("'"))) {
    try {
      if (input.startsWith('"')) {
        return JSON.parse(input);
      }
      return input.slice(1, -1).replace(/''/g, "'");
    } catch {
      return input.slice(1, -1);
    }
  }

  if ((input.startsWith('[') && input.endsWith(']')) || (input.startsWith('{') && input.endsWith('}'))) {
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }

  return input;
}

export function normalizeKey(key: string): string {
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    return key.slice(1, -1);
  }
  return key;
}

export function stringifyToYaml(
  value: unknown,
  indentLevel: number,
  options: YamlJsonStringifyOptions
): string {
  const indent = ' '.repeat(indentLevel);
  if (Array.isArray(value)) {
    if (!value.length) {
      return `${indent}[]`;
    }
    return value
      .map((item) => {
        if (isScalar(item)) {
          return `${indent}- ${formatScalar(item, options)}`;
        }
        const nested = stringifyToYaml(item, indentLevel + options.indent, options);
        return `${indent}-\n${nested}`;
      })
      .join('\n');
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) {
      return `${indent}{}`;
    }
    const builder: string[] = [];
    entries.forEach(([key, val]) => {
      const safeKey = formatKey(key);
      if (isScalar(val)) {
        builder.push(`${indent}${safeKey}: ${formatScalar(val, options)}`);
      } else {
        const nested = stringifyToYaml(val, indentLevel + options.indent, options);
        builder.push(`${indent}${safeKey}:\n${nested}`);
      }
    });
    return builder.join('\n');
  }

  return `${indent}${formatScalar(value, options)}`;
}

export function isScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

export function formatScalar(value: unknown, options: YamlJsonStringifyOptions): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : `"${value}"`;
  }
  if (typeof value === 'string') {
    if (!value.length) {
      return '""';
    }
    if (!options.quoteStrings) {
      const simple = /^[A-Za-z0-9_.\- ]+$/.test(value);
      if (simple && !value.includes(':') && !value.includes('- ')) {
        return value;
      }
    }
    const escaped = value.replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  return JSON.stringify(value);
}

export function formatKey(key: string): string {
  if (/^[A-Za-z0-9_.-]+$/.test(key)) {
    return key;
  }
  return `"${key.replace(/"/g, '\\"')}"`;
}

export function sortYamlJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortYamlJsonValue(item));
  }
  if (value && typeof value === 'object') {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort((a, b) =>
      a.localeCompare(b)
    );
    const result: Record<string, unknown> = {};
    sortedKeys.forEach((key) => {
      result[key] = sortYamlJsonValue((value as Record<string, unknown>)[key]);
    });
    return result;
  }
  return value;
}
